import "server-only";

import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { getRoomMemberProfile } from "@/features/room/profile/member-server";

interface Message {
  id: number;
  text: string;
}

const runtime = globalThis as typeof globalThis & {
  moaMockDirectMessages?: Map<string, Message[]>;
};
const threads = (runtime.moaMockDirectMessages ??= new Map<string, Message[]>());

export async function getDirectConversation(roomId: string, accountId: string) {
  const [entry, member] = await Promise.all([
    getFirstRoomProfile(roomId),
    getRoomMemberProfile(roomId, accountId),
  ]);
  if (!entry?.setup || !member || member.status !== "ACTIVE" || member.isSelf) return null;
  const key = `${entry.setup.key}:${member.membershipId}`;
  return { key, member, messages: threads.get(key) ?? [] };
}

export function appendMockDirectMessage(key: string, text: string) {
  const messages = threads.get(key) ?? [];
  threads.set(key, [...messages, { id: messages.length + 1, text }]);
}
