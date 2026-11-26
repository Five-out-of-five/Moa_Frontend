import { readEventId, type RoomEvent } from "@/features/realtime/room-event";

export const IDEA_CARD_DATA_EVENTS: readonly string[] = ["CARD_UPDATED", "CARD_MOVED", "COMMENT_CHANGED", "REACTION_CHANGED"];
export const IDEA_SESSION_EVENTS: readonly string[] = ["SESSION_STARTED", "SESSION_CLOSED"];
export const IDEA_BOARD_EVENTS: readonly string[] = [
  ...IDEA_CARD_DATA_EVENTS, ...IDEA_SESSION_EVENTS, "CARD_CREATED", "CARD_DELETED", "CONFLICT_CHANGED",
  "TASK_UPDATED", "TASK_DELETED", "VOTE_UPDATED", "VOTE_CLOSED", "VOTE_DELETED",
];

export function shouldReloadIdeaCard({ type, payload }: RoomEvent, cardId: number, sessionId: number) {
  if (type === "CONFLICT_CHANGED") return true;
  if (type === "SESSION_CLOSED") return readEventId(payload, "sessionId") === sessionId;
  if (!IDEA_CARD_DATA_EVENTS.includes(type)) return false;
  if (type === "CARD_MOVED" && Array.isArray(payload)) {
    return payload.some((card) => readEventId(card, "cardId") === cardId);
  }
  return readEventId(payload, "cardId") === cardId;
}

type CardLock = { accountId: number; expiresAt: number };

export function updateIdeaCardLocks(locks: ReadonlyMap<number, CardLock>, { type, payload }: RoomEvent, now: number) {
  if (type !== "CARD_LOCKED" && type !== "CARD_UNLOCKED" && type !== "CARD_DELETED") return locks;
  const cardId = readEventId(payload, "cardId");
  if (!cardId) return locks;
  if (type === "CARD_LOCKED") {
    const accountId = readEventId(payload, "lockedBy");
    if (!accountId) return locks;
    // 백엔드의 편집 잠금은 30초 후 만료되며, 잠금 갱신마다 이벤트를 보낸다.
    return new Map(locks).set(cardId, { accountId, expiresAt: now + 30_000 });
  }
  if (!locks.has(cardId)) return locks;
  const updated = new Map(locks);
  updated.delete(cardId);
  return updated;
}
