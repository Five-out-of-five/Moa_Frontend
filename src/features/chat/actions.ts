"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isNextControlFlowError } from "@/lib/next-redirect";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

import type {
  ChannelMemberStatus,
  ChannelType,
  ChatChannel,
  ChatChannelMember,
} from "./types";

type ChannelResponse = components["schemas"]["ChannelResponse"];
type ChannelMemberResponse = components["schemas"]["ChannelMemberResponse"];

const channelTypeSchema = z.enum(["PUBLIC", "PRIVATE", "DIRECT"]);

/**
 * 채널 생성 입력 — Figma Make "새 채널" 다이얼로그가 보내는 shape.
 *
 * ⚠️ `channelType = DIRECT` 는 이 액션으로 만들지 않는다 (PR C 의 `direct-channels` 전용 흐름).
 *    혹시 DIRECT 가 섞여 들어오면 BE 가 거절하므로 스키마에서도 선제 배제.
 * ⚠️ `memberAccountIds` 는 BE 에서 **PRIVATE 생성 시에만 의미**가 있다 (공개 채널은 방 멤버 전원 자동
 *    구독). PUBLIC 일 때 UI 가 비워 보내면 BE 가 그대로 무시.
 */
const createChannelSchema = z.object({
  roomId: z.number().int().positive(),
  name: z.string().trim().min(1, "채널 이름을 입력해 주세요.").max(30, "채널 이름은 30자 이하로 입력해 주세요."),
  channelType: z.enum(["PUBLIC", "PRIVATE"]),
  memberAccountIds: z.array(z.number().int().positive()).optional(),
});

const updateChannelSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  name: z.string().trim().min(1, "채널 이름을 입력해 주세요.").max(30, "채널 이름은 30자 이하로 입력해 주세요.").optional(),
  channelType: channelTypeSchema.optional(),
});

/** 삭제는 **채널 이름 재입력** 으로 confirm (실수 방지, BE 가 강제). */
const deleteChannelSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  confirmName: z.string().min(1, "채널 이름을 입력해 확인해 주세요."),
});

const channelPathSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
});

const addMembersSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  accountIds: z.array(z.number().int().positive()).min(1, "초대할 멤버를 1명 이상 선택해 주세요."),
});

const kickMemberSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
  targetAccountId: z.number().int().positive(),
});

export type CreateChannelResult =
  | { kind: "ok"; channel: ChatChannel }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type UpdateChannelResult =
  | { kind: "ok"; channel: ChatChannel }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type DeleteChannelResult =
  | { kind: "ok" }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type JoinChannelResult =
  | { kind: "ok"; channel: ChatChannel }
  | { kind: "error"; message: string };

export type LeaveChannelResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

export type AcceptInvitationResult =
  | { kind: "ok"; channel: ChatChannel }
  | { kind: "error"; message: string };

export type AddChannelMembersResult =
  | { kind: "ok"; members: ChatChannelMember[] }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type KickChannelMemberResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

/** 사이드바·채널 페이지가 함께 revalidate 되도록 공용 경로를 한 묶음으로 flush. */
function revalidateRoomChat(roomId: number) {
  revalidatePath(`/rooms/${roomId}`, "layout");
}

function mapChannel(res: ChannelResponse, roomId: number): ChatChannel {
  const channelType = (res.channelType ?? "PUBLIC") as ChannelType;
  return {
    id: res.channelId ?? 0,
    roomId,
    kind: channelType === "PUBLIC" ? "PUBLIC" : "PRIVATE",
    channelType,
    name: (channelType === "DIRECT" ? res.peer?.displayName : res.name) ?? "이름 없는 채널",
    unreadCount: res.unreadCount ?? 0,
    isDefault: res.isDefault ?? undefined,
    creatorAccountId: res.creatorAccountId ?? undefined,
    myStatus: (res.myStatus as ChannelMemberStatus | undefined) ?? undefined,
  };
}

function mapMembers(list: ChannelMemberResponse[]): ChatChannelMember[] {
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

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

/**
 * 채널 생성 — 명세 `POST /api/v1/rooms/{roomId}/channels`.
 *
 * ⚠️ 목 모드는 쓰기를 반영하지 않고 **입력을 그대로 ChatChannel 로 조립**해 돌려준다. 목 저장소에
 *    실제로 저장하려면 공유 Map 세팅이 필요한데, 채팅은 실 API 전환이 임박해 그 비용이 비효율.
 *    사용자가 다이얼로그를 닫으면 사이드바가 revalidate 된 **원래 목 데이터**로 복귀한다.
 */
export async function createChannelAction(input: unknown): Promise<CreateChannelResult> {
  const parsed = createChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, name, channelType, memberAccountIds } = parsed.data;

  if (isMock) {
    revalidateRoomChat(roomId);
    return {
      kind: "ok",
      channel: {
        id: Math.floor(Math.random() * 1_000_000),
        roomId,
        kind: channelType,
        channelType,
        name,
        unreadCount: 0,
        myStatus: "JOINED",
      },
    };
  }

  try {
    const res = await api<ChannelResponse>(`/api/v1/rooms/${roomId}/channels`, {
      method: "POST",
      json: { name, channelType, memberAccountIds: memberAccountIds ?? [] },
    });
    revalidateRoomChat(roomId);
    return { kind: "ok", channel: mapChannel(res, roomId) };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "채널 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/**
 * 채널 수정 — 명세 `PATCH /api/v1/rooms/{roomId}/channels/{channelId}`.
 * `name` / `channelType` 중 바꾼 값만 보낸다 (BE 가 nullable 로 유지 로직 적용).
 */
export async function updateChannelAction(input: unknown): Promise<UpdateChannelResult> {
  const parsed = updateChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, channelId, name, channelType } = parsed.data;

  if (isMock) {
    revalidateRoomChat(roomId);
    return {
      kind: "ok",
      channel: {
        id: channelId,
        roomId,
        kind: channelType === "DIRECT" ? "PRIVATE" : (channelType ?? "PUBLIC"),
        channelType: channelType ?? "PUBLIC",
        name: name ?? "채널",
        unreadCount: 0,
      },
    };
  }

  try {
    const res = await api<ChannelResponse>(
      `/api/v1/rooms/${roomId}/channels/${channelId}`,
      { method: "PATCH", json: { name, channelType } },
    );
    revalidateRoomChat(roomId);
    return { kind: "ok", channel: mapChannel(res, roomId) };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "채널 수정에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/**
 * 채널 삭제 — 명세 `DELETE /api/v1/rooms/{roomId}/channels/{channelId}` (body `{confirmName}`).
 * 삭제 불가 채널(기본 채널)·이름 불일치는 BE 가 400 으로 거절한다.
 */
export async function deleteChannelAction(input: unknown): Promise<DeleteChannelResult> {
  const parsed = deleteChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, channelId, confirmName } = parsed.data;

  if (isMock) {
    revalidateRoomChat(roomId);
    return { kind: "ok" };
  }

  try {
    await api(`/api/v1/rooms/${roomId}/channels/${channelId}`, {
      method: "DELETE",
      json: { confirmName },
    });
    revalidateRoomChat(roomId);
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) {
      // "채널 이름이 일치하지 않음" 같은 검증 실패는 confirmName 필드 아래로 떨궈 입력창 옆에 노출.
      return { kind: "error", message: e.message, fieldErrors: { confirmName: e.message } };
    }
    return { kind: "error", message: "채널 삭제에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 공개 채널 참여 — 명세 `POST /api/v1/rooms/{roomId}/channels/{channelId}/join`. */
export async function joinChannelAction(input: unknown): Promise<JoinChannelResult> {
  const parsed = channelPathSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, channelId } = parsed.data;

  if (isMock) {
    revalidateRoomChat(roomId);
    return {
      kind: "ok",
      channel: {
        id: channelId,
        roomId,
        kind: "PUBLIC",
        channelType: "PUBLIC",
        name: "채널",
        unreadCount: 0,
        myStatus: "JOINED",
      },
    };
  }

  try {
    const res = await api<ChannelResponse>(
      `/api/v1/rooms/${roomId}/channels/${channelId}/join`,
      { method: "POST" },
    );
    revalidateRoomChat(roomId);
    return { kind: "ok", channel: mapChannel(res, roomId) };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "채널 참여에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 채널 나가기 — 명세 `POST /api/v1/rooms/{roomId}/channels/{channelId}/leave`. */
export async function leaveChannelAction(input: unknown): Promise<LeaveChannelResult> {
  const parsed = channelPathSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, channelId } = parsed.data;

  if (isMock) {
    revalidateRoomChat(roomId);
    return { kind: "ok" };
  }

  try {
    await api(`/api/v1/rooms/${roomId}/channels/${channelId}/leave`, { method: "POST" });
    revalidateRoomChat(roomId);
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "채널 나가기에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 초대 수락 — 명세 `POST /api/v1/rooms/{roomId}/channels/{channelId}/accept-invitation`. */
export async function acceptInvitationAction(input: unknown): Promise<AcceptInvitationResult> {
  const parsed = channelPathSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, channelId } = parsed.data;

  if (isMock) {
    revalidateRoomChat(roomId);
    return {
      kind: "ok",
      channel: {
        id: channelId,
        roomId,
        kind: "PRIVATE",
        channelType: "PRIVATE",
        name: "채널",
        unreadCount: 0,
        myStatus: "JOINED",
      },
    };
  }

  try {
    const res = await api<ChannelResponse>(
      `/api/v1/rooms/${roomId}/channels/${channelId}/accept-invitation`,
      { method: "POST" },
    );
    revalidateRoomChat(roomId);
    return { kind: "ok", channel: mapChannel(res, roomId) };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "초대 수락에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 채널 멤버 추가 — 명세 `POST /api/v1/rooms/{roomId}/channels/{channelId}/members`. */
export async function addChannelMembersAction(input: unknown): Promise<AddChannelMembersResult> {
  const parsed = addMembersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, channelId, accountIds } = parsed.data;

  if (isMock) {
    revalidateRoomChat(roomId);
    return { kind: "ok", members: [] };
  }

  try {
    const res = await api<ChannelMemberResponse[]>(
      `/api/v1/rooms/${roomId}/channels/${channelId}/members`,
      { method: "POST", json: { accountIds } },
    );
    revalidateRoomChat(roomId);
    return { kind: "ok", members: mapMembers(res) };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "멤버 추가에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 채널 멤버 내보내기 — 명세 `DELETE /api/v1/rooms/{roomId}/channels/{channelId}/members/{targetId}`. */
export async function kickChannelMemberAction(input: unknown): Promise<KickChannelMemberResult> {
  const parsed = kickMemberSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, channelId, targetAccountId } = parsed.data;

  if (isMock) {
    revalidateRoomChat(roomId);
    return { kind: "ok" };
  }

  try {
    await api(
      `/api/v1/rooms/${roomId}/channels/${channelId}/members/${targetAccountId}`,
      { method: "DELETE" },
    );
    revalidateRoomChat(roomId);
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "멤버 내보내기에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}
