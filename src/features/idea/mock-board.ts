import "server-only";

import { boardSessions } from "@/mocks/db";
import type { BoardSession } from "@/types/db";

const runtime = globalThis as typeof globalThis & { moaIdeaRevisions?: Map<number, number> };
const revisions = (runtime.moaIdeaRevisions ??= new Map());

export function getIdeaRevision(roomId: number) {
  return revisions.get(roomId) ?? 0;
}

export function markIdeaChanged(roomId: number) {
  revisions.set(roomId, getIdeaRevision(roomId) + 1);
}

export function closeExpiredIdeaSession(roomId: number) {
  const session = boardSessions.find((item) => item.roomId === roomId && item.state === "ACTIVE");
  if (!session?.endsAt || Date.parse(session.endsAt) > Date.now()) return;
  session.state = "CLOSED";
  markIdeaChanged(roomId);
}

export function scheduleIdeaClose(session: BoardSession) {
  const endAt = session.endsAt;
  if (!endAt) return;
  const timer = setTimeout(() => {
    if (!boardSessions.includes(session) || session.state !== "ACTIVE") return;
    if (Date.parse(endAt) > Date.now()) scheduleIdeaClose(session);
    else closeExpiredIdeaSession(session.roomId);
  }, Math.min(2_147_483_647, Math.max(0, Date.parse(endAt) - Date.now())));
  timer.unref();
}
