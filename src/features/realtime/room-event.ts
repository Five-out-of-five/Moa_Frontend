export type RoomEvent = {
  type: string;
  payload: unknown;
};

export type PresenceEvent = { accountId: number; online: boolean };

export function readEventId(payload: unknown, field: string) {
  if (!payload || typeof payload !== "object" || !(field in payload)) return;
  const id: unknown = Reflect.get(payload, field);
  if (typeof id === "number" && Number.isSafeInteger(id) && id > 0) return id;
}

export function parsePresenceEvent(body: string): PresenceEvent | null {
  try {
    const value: unknown = JSON.parse(body);
    const accountId = readEventId(value, "accountId");
    if (accountId && value && typeof value === "object" && "online" in value && typeof value.online === "boolean") {
      return { accountId, online: value.online };
    }
  } catch {
    // 다음 presence 이벤트는 계속 처리한다.
  }
  return null;
}

export function parseRoomEvent(body: string): RoomEvent | null {
  try {
    const value: unknown = JSON.parse(body);
    if (value && typeof value === "object" && "type" in value && typeof value.type === "string" && "payload" in value) {
      return { type: value.type, payload: value.payload };
    }
  } catch {
    // 잘못된 메시지 하나로 방 구독을 끊지 않는다.
  }
  return null;
}
