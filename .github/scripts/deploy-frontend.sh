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
container=$("${compose[@]}" ps --status running -q front)
previous_image=$("${docker[@]}" inspect --format '{{.Image}}' "${container:?No running frontend to back up}")
"${docker[@]}" tag "$previous_image" moa-front:rollback

echo "Building frontend at $sha"
"${compose[@]}" build front
new_image=$("${docker[@]}" image inspect --format '{{.Id}}' moa-front:latest)

wait_for_frontend() {
  local expected_image=$1 container_id running_image
  for _ in {1..24}; do
    if container_id=$("${compose[@]}" ps --status running -q front) && [[ -n "$container_id" ]] &&
      running_image=$("${docker[@]}" inspect --format '{{.Image}}' "$container_id") &&
      [[ "$running_image" == "$expected_image" ]] &&
      curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
      return 0
    fi
    sleep 5
  done
  return 1
}

if "${compose[@]}" up -d --no-deps --no-build --pull never front && wait_for_frontend "$new_image"; then
  echo "Frontend deployment succeeded: $sha"
  exit 0
fi

echo 'Frontend did not become ready. Restoring the previous image.' >&2
if "${docker[@]}" tag moa-front:rollback moa-front:latest &&
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate front &&
  wait_for_frontend "$previous_image"; then
  echo 'Previous frontend image restored.' >&2
else
  echo 'Rollback failed. Check the frontend container on EC2.' >&2
fi
exit 1
