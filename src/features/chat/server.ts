import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { roomMembers } from "@/mocks/db";

import { CHAT_CHANNELS, DM_THREADS } from "./mock-seed";
import type { ChatChannel, DirectMessageThread } from "./types";

/**
 * 내가 속한 방들의 채널 전부. Shell 사이드바가 쓴다 — 어느 방을 보고 있는지는
 * 사이드바 쪽에서 URL 로 판단하므로 서버는 그냥 "내가 볼 수 있는 모든 채널" 만 돌려준다.
 *
 * ⚠️ 목 모드에서는 홍근 계정(id=1) 의 방 소속을 기준으로 필터링한다. BE 가 붙으면 세션에서
 *    accountId 를 뽑는다.
 */
export async function listMyChannels(): Promise<ChatChannel[]> {
  if (isMock) {
    const me = 1;
    const myRoomIds = new Set(
      roomMembers.filter((m) => m.accountId === me).map((m) => m.roomId),
    );
    return CHAT_CHANNELS.filter((c) => myRoomIds.has(c.roomId));
  }
  return api<ChatChannel[]>("/api/v1/accounts/me/channels");
}

/** 내 1:1 메시지 스레드 전부 */
export async function listMyDmThreads(): Promise<DirectMessageThread[]> {
  if (isMock) return DM_THREADS;
  return api<DirectMessageThread[]>("/api/v1/accounts/me/dms");
}
