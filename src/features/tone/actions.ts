"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { getMyAccount } from "@/features/account/server";
import { getChannel } from "@/features/chat/server";
import { getManagedRoom } from "@/features/room/management/server";
import { api, ApiError } from "@/lib/api";
import { getApiAccountContext } from "@/lib/api-account";
import { isAuthor } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards } from "@/mocks/db";
import type { components } from "@/types/api";

import type { ToneResult, ToneSettingsResult, ToneTarget } from "./model";
import { getToneMode } from "./server";

const modeSchema = z.enum(["OFF", "POLISH", "POLITE"]);
const id = z.number().int().positive();
const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CARD"), roomId: id, sessionId: id, cardId: id.optional() }),
  z.object({ kind: z.literal("CHAT"), roomId: id, channelId: id }),
]);

export async function saveToneSettingsAction(
  _: ToneSettingsResult,
  form: FormData,
): Promise<ToneSettingsResult> {
  const mode = modeSchema.safeParse(form.get("toneMode"));
  if (!mode.success) return { error: "순화 방식을 선택해 주세요." };
  try {
    let savedMode = mode.data;
    if (isMock) (await getMyAccount()).toneMode = savedMode;
    else {
      const account = await api<components["schemas"]["MyAccountResponse"]>("/api/v1/accounts/me/ai-settings", {
        cache: "no-store",
        method: "PATCH",
        json: { toneMode: mode.data },
      });
      savedMode = account.toneMode ?? savedMode;
    }
    revalidatePath("/", "layout");
    return { saved: true, mode: savedMode };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "순화 설정을 저장하지 못했어요. 다시 시도해 주세요.",
    };
  }
}

export async function reviewToneAction(
  input: ToneTarget,
  text: string,
  maxLength: number,
): Promise<ToneResult> {
  const parsed = targetSchema.safeParse(input);
  if (
    !parsed.success ||
    ![100, 1000, 2000].includes(maxLength) ||
    typeof text !== "string" ||
    !text.trim() ||
    text.length > maxLength
  )
    return { ok: false, error: "검토할 내용을 입력 범위에 맞게 작성해 주세요." };
  const target = parsed.data;
  if (
    (target.kind === "CHAT" && maxLength !== 2000) ||
    (target.kind === "CARD" && maxLength === 2000)
  )
    return { ok: false, error: "검토 대상을 확인해 주세요." };
  try {
    const mode = await getToneMode();
    if (mode === "OFF") return { ok: false, error: "계정 설정에서 톤앤매너 순화를 켜 주세요." };
    if (isMock) {
      const context = await getManagedRoom(target.roomId);
      if (!context) return { ok: false, error: "이 방의 내용을 검토할 권한이 없어요." };
      if (target.kind === "CARD") {
        const session = boardSessions.find(
          ({ id, roomId, state, endsAt }) =>
            id === target.sessionId &&
            roomId === target.roomId &&
            state === "ACTIVE" &&
            (!endsAt || Date.parse(endsAt) > Date.now()),
        );
        if (!session) return { ok: false, error: "진행 중인 회차에서만 검토할 수 있어요." };
        if (target.cardId !== undefined) {
          const card = ideaCards.find(
            ({ id, roomId, sessionId }) =>
              id === target.cardId && roomId === target.roomId && sessionId === target.sessionId,
          );
          if (!card || !isAuthor(context.account, card.author))
            return { ok: false, error: "본인의 카드만 검토할 수 있어요." };
        }
      } else if (!(await getChannel(target.roomId, target.channelId)))
        return { ok: false, error: "검토할 채널을 찾을 수 없어요." };
      await new Promise((resolve) => setTimeout(resolve, 500));
      let suggestion = text
        .replace(/너 때문에/g, "이 상황으로 인해")
        .replace(/짜증나[요]?/g, "아쉬움이 있어요")
        .replace(/빨리 해[라줘]?/g, "우선적으로 진행해 주세요")
        .replace(/왜 이렇게/g, "어떤 이유로 이렇게")
        .replace(/멍청[한하]/g, "아쉬운");
      if (mode === "POLITE")
        suggestion = suggestion
          .replace(/해줘/g, "부탁드려요")
          .replace(/확인해(?!요)/g, "확인해 주세요");
      return { ok: true, needsChange: suggestion !== text, suggestion };
    }
    const { init, query, accountId } = await getApiAccountContext();
    if (target.kind === "CARD") {
      const session = await api<components["schemas"]["SessionResponse"]>(
        `/api/v1/rooms/${target.roomId}/sessions/${target.sessionId}?${query}`,
        init,
      );
      if (
        session.status !== "IN_PROGRESS" ||
        (session.deadlineAt && Date.parse(session.deadlineAt) <= Date.now())
      )
        return { ok: false, error: "진행 중인 회차에서만 검토할 수 있어요." };
      if (target.cardId !== undefined) {
        const card = await api<components["schemas"]["IdeaCardDetailResponse"]>(
          `/api/v1/rooms/${target.roomId}/idea-cards/${target.cardId}?${query}`,
          init,
        );
        if (card.sessionId !== target.sessionId || card.writer?.accountId !== accountId)
          return { ok: false, error: "본인의 카드만 검토할 수 있어요." };
      }
    } else await api(`/api/v1/rooms/${target.roomId}/channels/${target.channelId}`, init);
    const result = await api<components["schemas"]["ToneCheckResponse"]>(
      `/api/v1/rooms/${target.roomId}/ai/tone-checks?${query}`,
      {
        ...init,
        method: "POST",
        json: {
          text,
          target: target.kind,
          ...(target.kind === "CHAT" ? { channelId: target.channelId } : {}),
        },
      },
    );
    if (
      typeof result.needsChange !== "boolean" ||
      (result.needsChange && !result.suggestion?.trim())
    )
      throw new Error();
    return { ok: true, needsChange: result.needsChange, suggestion: result.suggestion ?? text };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ApiError
          ? error.message
          : "검토 응답을 받지 못했어요. 원문은 유지돼요. 다시 시도해 주세요.",
    };
  }
}
