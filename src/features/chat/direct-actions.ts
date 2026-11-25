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
} from "./types";

type ChannelResponse = components["schemas"]["ChannelResponse"];

/**
 * 1:1 대화 시작 입력 — 멤버 검색에서 상대를 하나 고르면 보낸다.
 *
 * ⚠️ BE 는 **이미 있는 DIRECT 채널이면 재생성 없이 기존 채널을 돌려준다** (upsert 성격).
 *    따라서 "중복 생성 방지" 로직은 FE 가 따로 둘 필요 없음.
 */
const createDirectSchema = z.object({
  roomId: z.number().int().positive(),
  targetAccountId: z.number().int().positive(),
});

const channelPathSchema = z.object({
  roomId: z.number().int().positive(),
  channelId: z.number().int().positive(),
});

export type CreateDirectChannelResult =
  | { kind: "ok"; channel: ChatChannel }
  | { kind: "error"; message: string };

export type HideDirectChannelResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

/** 사이드바·DM 라우트가 함께 갱신되도록 공용 revalidate. */
function revalidateChatScope(roomId: number) {
  // 사이드바(채팅 리스트) 는 shell layout 아래 전역 — roomId 범위로 flush 해도 사이드바
  // Loader 는 내 방 전체를 다시 긁어오므로 충분.
  revalidatePath(`/rooms/${roomId}`, "layout");
  revalidatePath("/dms", "layout");
}

function mapChannel(res: ChannelResponse, roomId: number): ChatChannel {
  const channelType = (res.channelType ?? "DIRECT") as ChannelType;
  return {
    id: res.channelId ?? 0,
    roomId,
    // 사이드바 kind 분기 호환용. DIRECT 는 사이드바에 노출되지 않고 DM 리스트로 빠지지만
    // ChatChannel 는 공통 shape 이라 좁은 kind 값 중 하나는 채워 둬야 한다.
    kind: channelType === "PUBLIC" ? "PUBLIC" : "PRIVATE",
    channelType,
    name: (channelType === "DIRECT" ? res.peer?.displayName : res.name) ?? "이름 없는 채널",
    unreadCount: res.unreadCount ?? 0,
    isDefault: res.isDefault ?? undefined,
    creatorAccountId: res.creatorAccountId ?? undefined,
    myStatus: (res.myStatus as ChannelMemberStatus | undefined) ?? undefined,
  };
}

/**
 * 1:1 대화 시작 — 명세 `POST /api/v1/rooms/{roomId}/direct-channels`.
 *
 * 응답의 ChannelResponse 를 ChatChannel 로 매핑해 돌려준다. 호출부는 `channel.id` 로
 * 바로 `/dms/{id}` 라우트로 이동시킬 수 있다.
 */
export async function createDirectChannelAction(
  input: unknown,
): Promise<CreateDirectChannelResult> {
  const parsed = createDirectSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, targetAccountId } = parsed.data;

  if (isMock) {
    revalidateChatScope(roomId);
    return {
      kind: "ok",
      channel: {
        id: Math.floor(Math.random() * 1_000_000),
        roomId,
        kind: "PRIVATE",
        channelType: "DIRECT",
        name: `사용자 ${targetAccountId}`,
        unreadCount: 0,
        myStatus: "JOINED",
      },
    };
  }

  try {
    const res = await api<ChannelResponse>(
      `/api/v1/rooms/${roomId}/direct-channels`,
      { method: "POST", json: { targetAccountId } },
    );
    revalidateChatScope(roomId);
    return { kind: "ok", channel: mapChannel(res, roomId) };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "1:1 대화를 시작하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/**
 * 1:1 대화 숨기기 — 명세 `POST /api/v1/rooms/{roomId}/channels/{channelId}/hide`.
 *
 * ⚠️ 숨김은 **삭제가 아님**. 사이드바에서만 안 보일 뿐 상대가 다시 메시지를 보내면 재노출.
 */
export async function hideDirectChannelAction(
  input: unknown,
): Promise<HideDirectChannelResult> {
  const parsed = channelPathSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, channelId } = parsed.data;

  if (isMock) {
    revalidateChatScope(roomId);
    return { kind: "ok" };
  }

  try {
    await api(
      `/api/v1/rooms/${roomId}/channels/${channelId}/hide`,
      { method: "POST" },
    );
    revalidateChatScope(roomId);
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "1:1 대화 숨기기에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}
