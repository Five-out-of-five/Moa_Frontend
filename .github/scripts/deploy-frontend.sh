#!/usr/bin/env bash
set -euo pipefail

sha=${1:?Missing deployment commit}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
front_dir=/home/ubuntu/Moa_Front
cd /home/ubuntu/Moa_Backend

exec 9> "$HOME/.moa-frontend-deploy.lock"
if ! flock -n 9; then
  echo 'Another frontend deployment is running.' >&2
  exit 1
fi

if [[ $(git -C "$front_dir" branch --show-current) != main || -n $(git -C "$front_dir" status --porcelain) ]]; then
  echo 'The frontend checkout must be on main with a clean working tree.' >&2
  exit 1
fi

git -C "$front_dir" fetch origin main
if [[ $(git -C "$front_dir" rev-parse FETCH_HEAD) != "$sha" ]]; then
  echo 'main moved after this workflow started. Run deployment again for the latest commit.' >&2
  exit 1
fi
git -C "$front_dir" merge --ff-only "$sha"
[[ $(git -C "$front_dir" rev-parse HEAD) == "$sha" ]]

docker=(sudo -n docker)
compose=(sudo -n env "FRONT_DIR=$front_dir" docker compose -f docker-compose.prod.yml)

container_image_id() {
  "${docker[@]}" inspect --type container --format '{{with index .Config.Labels "com.docker.compose.image"}}{{.}}{{else}}{{$.Image}}{{end}}' "$1"
}

image_ids() {
  local details image_id platform platform_id
  details=$("${docker[@]}" image inspect --format '{{.Id}} {{.Os}}/{{.Architecture}}' "$1") || return 1
  read -r image_id platform <<< "$details"
  # Compose can record a platform digest while Docker tags refer to the image index.
  if ! platform_id=$("${docker[@]}" image inspect --platform "$platform" --format '{{.Id}}' "$1" 2>/dev/null); then
    platform_id=$image_id
  fi
  printf '%s %s\n' "$image_id" "$platform_id"
}

container=$("${compose[@]}" ps --status running -q front)
previous_id=$(container_image_id "${container:?No running frontend to back up}")
backup_ref=
for candidate in moa-front:latest moa-front:rollback "$previous_id"; do
  if ids=$(image_ids "$candidate" 2>/dev/null) && [[ " $ids " == *" $previous_id "* ]]; then
    backup_ref=$candidate
    break
  fi
done
if [[ -z "$backup_ref" ]]; then
  echo "No local image matches the running frontend ($previous_id). Stopping before build or replacement." >&2
  exit 1
fi
if [[ "$backup_ref" != moa-front:rollback ]] && ! "${docker[@]}" tag "${ids%% *}" moa-front:rollback; then
  echo "Unable to back up the running frontend image from $backup_ref." >&2
  exit 1
fi
rollback_ids=$(image_ids moa-front:rollback)
if [[ " $rollback_ids " != *" $previous_id "* ]]; then
  echo 'Rollback image does not match the running frontend. Stopping before build or replacement.' >&2
  exit 1
fi
echo "Backed up the running frontend ($previous_id) as moa-front:rollback"

echo "Building frontend at $sha"
if ! "${compose[@]}" build front; then
  echo 'Frontend build failed. The running frontend was not replaced.' >&2
  exit 1
fi
new_ids=$(image_ids moa-front:latest)

wait_for_frontend() {
  local expected_ids=$1 container_id running_image
  for _ in {1..24}; do
    if container_id=$("${compose[@]}" ps --status running -q front) && [[ -n "$container_id" ]] &&
      running_image=$(container_image_id "$container_id") &&
      [[ -n "$running_image" && " $expected_ids " == *" $running_image "* ]] &&
      curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
      return 0
    fi
    sleep 5
  done
  return 1
}

if "${compose[@]}" up -d --no-deps --no-build --pull never front && wait_for_frontend "$new_ids"; then
  echo "Frontend deployment succeeded: $sha"
  exit 0
fi

echo 'Frontend did not become ready. Restoring the previous image.' >&2
if "${docker[@]}" tag moa-front:rollback moa-front:latest &&
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate front &&
  wait_for_frontend "$rollback_ids"; then
  echo 'Previous frontend image restored.' >&2
else
  echo 'Rollback failed. Check the frontend container on EC2.' >&2
fi
exit 1
