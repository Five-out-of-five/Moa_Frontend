import "server-only";

import { cache } from "react";

import { getMyAccount } from "@/features/account/server";
import { listMyRooms } from "@/features/room/server";
import { api, ApiError } from "@/lib/api";
import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers } from "@/mocks/db";
import type { components } from "@/types/api";

import {
  CHANNEL_MESSAGES,
  CHAT_CHANNELS,
  DM_MESSAGES,
  DM_THREADS,
} from "./mock-seed";
import type {
  ChannelMemberStatus,
  ChannelType,
  ChatChannel,
  ChatChannelMember,
  ChatMessage,
  DirectMessageThread,
} from "./types";

const runtime = globalThis as typeof globalThis & {
  moaMockDms?: Map<number, { viewerId: number; thread: DirectMessageThread }>;
};
const mockDms = (runtime.moaMockDms ??= new Map());

type ChannelResponse = components["schemas"]["ChannelResponse"];

const listApiChannels = cache(async () => {
  const rooms = (await listMyRooms()).filter((room) => room.status !== "INACTIVE");
  const groups = await Promise.all(rooms.map(async (room) => {
    try {
      const channels = await api<ChannelResponse[]>(`/api/v1/rooms/${room.id}/channels`, { cache: "no-store" });
      return channels.map((channel) => ({ ...channel, roomId: room.id }));
    } catch (error) {
      if (error instanceof ApiError && ["ROOM_NOT_FOUND", "ROOM_NOT_MEMBER", "ROOM_INACTIVE"].includes(error.code)) return [];
      throw error;
    }
  }));
  return groups.flat();
});

function toChatChannel(channel: ChannelResponse, roomId: number): ChatChannel | null {
  if (channel.channelId == null || !channel.channelType) return null;
  const channelType = channel.channelType as ChannelType;
  return {
    id: channel.channelId,
    roomId,
    // `kind` 는 사이드바 PUBLIC/PRIVATE 분기용. DIRECT 는 DM 리스트로 빠지므로 여기 매핑은
    // "PUBLIC 아니면 PRIVATE" 로 좁혀도 충분. 원본 channelType 은 `channelType` 필드로 유지.
    kind: channelType === "PUBLIC" ? "PUBLIC" : "PRIVATE",
    channelType,
    name: (channelType === "DIRECT" ? channel.peer?.displayName : channel.name) ?? "이름 없는 채널",
    unreadCount: channel.unreadCount ?? 0,
    isDefault: channel.isDefault ?? undefined,
    creatorAccountId: channel.creatorAccountId ?? undefined,
    myStatus: (channel.myStatus as ChannelMemberStatus | undefined) ?? undefined,
  };
}

type ChannelMemberResponse = components["schemas"]["ChannelMemberResponse"];

/**
 * 채널 참여자 목록 — 명세 `GET /api/v1/rooms/{roomId}/channels/{channelId}/members`.
 *
 * ⚠️ 목 모드는 채널별 멤버 추적을 안 하므로 **해당 방의 활성 roomMembers 를 JOINED 로** 전부
 *    돌려준다. 멤버 추가/내보내기 액션의 mock 분기도 reader 결과를 그대로 반영하진 않지만
 *    UI 흐름 (목록 → 다이얼로그 → 확인) 은 깨지지 않는다.
 */
export async function listChannelMembers(
  roomId: number,
  channelId: number,
): Promise<ChatChannelMember[]> {
  if (isMock) {
    const inRoom = roomMembers.filter((m) => m.roomId === roomId && isActiveMember(m));
    return inRoom.flatMap((m) => {
      const acc = accounts.find((a) => a.id === m.accountId);
      if (!acc) return [];
      return [{
        accountId: acc.id,
        displayName: m.nickname ?? acc.name,
        profileImageUrl: null,
        status: "JOINED" as ChannelMemberStatus,
        online: false,
      }];
    });
  }
  const list = await api<ChannelMemberResponse[]>(
    `/api/v1/rooms/${roomId}/channels/${channelId}/members`,
    { cache: "no-store" },
  );
  return list.flatMap((m) => {
    if (m.accountId == null || !m.status) return [];
    return [{
      accountId: m.accountId,
      displayName: m.displayName ?? `사용자 ${m.accountId}`,
      profileImageUrl: m.profileImageUrl ?? null,
      status: m.status as ChannelMemberStatus,
      online: m.online ?? false,
    }];
  });
}

function listMockDmThreads(viewerId: number) {
  return [
    ...(viewerId === accounts[0]?.id ? DM_THREADS : []),
    ...Array.from(mockDms.values())
      .filter((entry) => entry.viewerId === viewerId)
      .map(({ thread }) => thread),
  ];
}

export function getMockPresence(accountId: number) {
  return DM_THREADS.find((thread) => thread.accountId === accountId)?.online;
}

export async function getOrCreateMockDm(accountId: number) {
  if (!isMock) return null;
  const viewer = await getMyAccount();
  const account = accounts.find(({ id }) => id === accountId);
  if (!account || account.id === viewer.id) return null;
  const existing = listMockDmThreads(viewer.id).find((thread) => thread.accountId === accountId);
  if (existing) return existing;
  const thread = {
    id: 1000 + mockDms.size,
    accountId,
    displayName: account.name,
    online: getMockPresence(accountId) ?? false,
    unreadCount: 0,
  };
  mockDms.set(thread.id, { viewerId: viewer.id, thread });
  return thread;
}

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
      roomMembers.filter((m) => m.accountId === me && isActiveMember(m)).map((m) => m.roomId),
    );
    return CHAT_CHANNELS.filter((c) => myRoomIds.has(c.roomId));
  }
  return (await listApiChannels()).flatMap((channel) => {
    const mapped = channel.channelType === "DIRECT" ? null : toChatChannel(channel, channel.roomId);
    return mapped ? [mapped] : [];
  });
}

/** 내 1:1 메시지 스레드 전부 */
export async function listMyDmThreads(): Promise<DirectMessageThread[]> {
  if (isMock) {
    const { id } = await getMyAccount();
    return listMockDmThreads(id);
  }
  return (await listApiChannels()).flatMap((channel) =>
    channel.channelType !== "DIRECT" || channel.channelId == null || channel.peer?.accountId == null ? [] : [{
      id: channel.channelId,
      roomId: channel.roomId,
      accountId: channel.peer.accountId,
      displayName: channel.peer.displayName ?? "이름 없는 멤버",
      online: false,
      unreadCount: channel.unreadCount ?? 0,
    }],
  );
}

/**
 * 채널 상세 — 메시지 페이지 상단 헤더에 쓴다.
 *
 * ⚠️ 목 모드에선 `CHAT_CHANNELS` 에서 `roomId + id` 가 매치되는 것만 돌려줘, 사이드바가
 *    보여주는 범위를 그대로 따라간다. 실 BE 는 소속 검사까지 서버에서.
 */
export async function getChannel(
  roomId: number,
  channelId: number,
): Promise<ChatChannel | null> {
  if (isMock) {
    return (
      CHAT_CHANNELS.find((c) => c.roomId === roomId && c.id === channelId) ??
      null
    );
  }
  // ⚠️ `api()` 는 실패 envelope 를 받으면 `ApiError` 를 던진다. 미존재 리소스를 null 로
  //    리턴해야 page 의 `notFound()` 분기가 작동하므로 404 만 null 로 변환하고 나머지는
  //    그대로 던져 상위 error boundary 로 올린다 (CodeRabbit).
  try {
    const channel = await api<ChannelResponse>(
      `/api/v1/rooms/${roomId}/channels/${channelId}`, { cache: "no-store" },
    );
    return toChatChannel(channel, roomId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * 채널의 **최근 메시지 묶음** — 메시지 페이지 초기 로드용.
 *
 * ⚠️ 명세 확정 전까지 페이지네이션 파라미터는 빼고 "최근 100건" 상한만 가정. WS 가 붙으면
 *    이 리턴 값은 초기 로드 1회 분으로 쓰고, 그 이후는 소켓 스트림이 밀어 넣는다.
 */
/**
 * 채널 메시지 목록 — 명세 `GET /api/v1/rooms/{roomId}/channels/{channelId}/messages` (커서).
 *
 * ⚠️ 커서 파라미터는 선택:
 *    - 아무것도 안 주면 BE 가 **최신 50건** 돌려줌 (초기 로드 흐름)
 *    - `before=<messageId>` 로 **그보다 이전** 메시지, `after=<messageId>` 로 **그 이후** 메시지
 *    - `size` 는 1..100, 생략 시 50
 * ⚠️ `nextCursor`/`hasNext` 는 UI 가 "더 불러오기" 를 붙일 때까지는 쓰지 않는다. 현재는
 *    배열만 반환해 호출부 하위 호환을 유지. 페이지네이션 UX 는 Phase 2.
 */
export async function getChannelMessages(
  roomId: number,
  channelId: number,
  params: { before?: number; after?: number; size?: number } = {},
): Promise<ChatMessage[]> {
  if (isMock) {
    return CHANNEL_MESSAGES[channelId] ?? [];
  }
  const query = new URLSearchParams();
  if (params.before != null) query.set("before", String(params.before));
  if (params.after != null) query.set("after", String(params.after));
  if (params.size != null) query.set("size", String(params.size));
  const queryString = query.toString();
  const response = await api<components["schemas"]["CursorResponseMessageResponse"]>(
    `/api/v1/rooms/${roomId}/channels/${channelId}/messages${queryString ? `?${queryString}` : ""}`,
    { cache: "no-store" },
  );
  return (response.items ?? []).flatMap((message) => message.messageId == null || !message.createdAt ? [] : [{
    id: message.messageId,
    author: { accountId: message.sender?.accountId ?? 0, displayName: message.sender?.displayName ?? "알 수 없는 사용자" },
    createdAt: message.createdAt,
    content: message.deleted ? "삭제된 메시지입니다." : message.content ?? "",
    deleted: message.deleted,
    isSystem: message.messageType === "SYSTEM",
    edited: message.edited ?? undefined,
    clientMessageId: message.clientMessageId ?? undefined,
    messageType: message.messageType as ChatMessage["messageType"] | undefined,
  }]).sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt) || first.id - second.id);
}

/**
 * 1:1 스레드 상세 — DM 페이지 헤더에 쓸 상대 정보. `ChatSidebar` 가 넘기는 thread id 와
 * 짝을 이룬다.
 */
export async function getDmThread(
  threadId: number,
): Promise<DirectMessageThread | null> {
  if (isMock) {
    return (await listMyDmThreads()).find((t) => t.id === threadId) ?? null;
  }
  // 404 만 null, 나머지는 throw (getChannel 과 같은 이유).
  try {
    return await api<DirectMessageThread>(
      `/api/v1/accounts/me/dms/${threadId}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** 1:1 스레드의 최근 메시지 묶음 — 채널 쪽과 같은 가정. */
export async function getDmMessages(
  threadId: number,
): Promise<ChatMessage[]> {
  if (isMock) {
    if (!(await getDmThread(threadId))) return [];
    return DM_MESSAGES[threadId] ?? [];
  }
  return api<ChatMessage[]>(
    `/api/v1/accounts/me/dms/${threadId}/messages?limit=100`,
  );
}
