import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { votes } from "@/mocks/db";
import type { Vote } from "@/types/db";

export async function listVotes(roomId: number): Promise<Vote[]> {
  if (isMock) return votes.filter((v) => v.roomId === roomId);
  return api<Vote[]>(`/api/v1/rooms/${roomId}/votes`);
}
