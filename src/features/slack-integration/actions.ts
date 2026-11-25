"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isNextControlFlowError } from "@/lib/next-redirect";
import { isMock } from "@/mocks/config";

import type { SlackIntegration } from "./types";

const slackEventTypeSchema = z.enum([
  "VOTE_CREATED",
  "VOTE_CLOSED",
  "TASK_DUE_SOON",
  "SESSION_SUMMARY",
]);

/**
 * 슬랙 연동 등록/수정 입력.
 *
 * ⚠️ `webhookUrl` 은 **수정 시 비워 두면 BE 가 기존 값 유지**. 교체하려면 새 URL 을 넣는다.
 *    형식 검증은 URL 로만 가볍게 — 상세한 Slack 도메인 검증은 BE 의 테스트 발송이 맡는다.
 */
const upsertSlackSchema = z.object({
  roomId: z.number().int().positive(),
  webhookUrl: z.string().url("웹훅 URL 형식이 올바르지 않습니다.").optional(),
  eventTypes: z.array(slackEventTypeSchema),
});

const testSlackSchema = z.object({
  roomId: z.number().int().positive(),
  webhookUrl: z.string().url("웹훅 URL 형식이 올바르지 않습니다."),
});

const roomOnlySchema = z.object({
  roomId: z.number().int().positive(),
});

export type UpsertSlackIntegrationResult =
  | { kind: "ok"; integration: SlackIntegration }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type TestSlackIntegrationResult =
  | { kind: "ok" }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type DeleteSlackIntegrationResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

function revalidateSlackScope(roomId: number) {
  // ⚠️ 연동 설정은 `/workspaces/manage?room={roomId}&tab=integrations` 경로. 쿼리 무관하게
  //    page 전체를 flush.
  revalidatePath("/workspaces/manage", "page");
  revalidatePath(`/rooms/${roomId}`, "layout");
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

/** 슬랙 연동 등록·수정 — 명세 `PUT /api/v1/rooms/{roomId}/integrations/slack`. */
export async function upsertSlackIntegrationAction(
  input: unknown,
): Promise<UpsertSlackIntegrationResult> {
  const parsed = upsertSlackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, webhookUrl, eventTypes } = parsed.data;

  if (isMock) {
    revalidateSlackScope(roomId);
    return {
      kind: "ok",
      integration: {
        connected: Boolean(webhookUrl),
        webhookUrlMasked: webhookUrl ? maskWebhook(webhookUrl) : null,
        eventTypes,
        enabled: true,
        consecutiveFailCount: 0,
        disabledAt: null,
      },
    };
  }

  try {
    const res = await api<SlackIntegration>(
      `/api/v1/rooms/${roomId}/integrations/slack`,
      { method: "PUT", json: { webhookUrl, eventTypes } },
    );
    revalidateSlackScope(roomId);
    return { kind: "ok", integration: res };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "슬랙 연동 저장에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/**
 * 슬랙 테스트 발송 — 명세 `POST /api/v1/rooms/{roomId}/integrations/slack/test`.
 *
 * ⚠️ 저장 전에 **webhookUrl 유효성만 검증** 하려는 흐름. 저장돼 있는 webhookUrl 을 다시 쓰는
 *    게 아니라 **입력 중인 URL** 로 BE 가 즉시 테스트 메시지를 날린다.
 */
export async function testSlackIntegrationAction(
  input: unknown,
): Promise<TestSlackIntegrationResult> {
  const parsed = testSlackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, webhookUrl } = parsed.data;

  if (isMock) return { kind: "ok" };

  try {
    await api(
      `/api/v1/rooms/${roomId}/integrations/slack/test`,
      { method: "POST", json: { webhookUrl } },
    );
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) {
      // 테스트 실패는 보통 "슬랙 응답 오류" — webhookUrl 필드 아래로 떨궈 입력창 옆에 노출.
      return { kind: "error", message: e.message, fieldErrors: { webhookUrl: e.message } };
    }
    return { kind: "error", message: "테스트 발송에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 슬랙 연동 해제 — 명세 `DELETE /api/v1/rooms/{roomId}/integrations/slack`. */
export async function deleteSlackIntegrationAction(
  input: unknown,
): Promise<DeleteSlackIntegrationResult> {
  const parsed = roomOnlySchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId } = parsed.data;

  if (isMock) {
    revalidateSlackScope(roomId);
    return { kind: "ok" };
  }

  try {
    await api(
      `/api/v1/rooms/${roomId}/integrations/slack`,
      { method: "DELETE" },
    );
    revalidateSlackScope(roomId);
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "슬랙 연동 해제에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

function maskWebhook(url: string): string {
  if (url.length <= 20) return "****";
  return `${url.slice(0, 10)}...${url.slice(-6)}`;
}
