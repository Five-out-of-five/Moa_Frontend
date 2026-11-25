"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isNextControlFlowError } from "@/lib/next-redirect";
import { isMock } from "@/mocks/config";

import type { NotionExport, NotionIntegration } from "./types";

const roomOnlySchema = z.object({
  roomId: z.number().int().positive(),
});

const updateNotionSchema = z.object({
  roomId: z.number().int().positive(),
  targetDatabaseId: z.string().min(1, "저장할 노션 DB 를 선택해 주세요."),
  exportMode: z.enum(["MANUAL", "ON_SESSION_CLOSE"]),
});

const exportNotionSchema = z.object({
  roomId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
});

export type AuthorizeNotionResult =
  | { kind: "ok"; authorizeUrl: string }
  | { kind: "error"; message: string };

export type UpdateNotionIntegrationResult =
  | { kind: "ok"; integration: NotionIntegration }
  // BE 가 설정 저장 시 DB 접근 확인 (INTEGRATION_NOTION_DATABASE_NOT_FOUND) 또는 토큰 만료
  // (INTEGRATION_NOTION_AUTH_EXPIRED) 를 409 로 돌려줄 수 있다. UI 가 각 케이스별로 입력창
  // 안내 vs 재연결 유도로 분기하도록 kind 를 쪼갠다.
  | { kind: "database_not_found"; message: string }
  | { kind: "auth_expired"; message: string }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export type ExportNotionResult =
  | { kind: "ok"; export: NotionExport }
  | { kind: "error"; message: string };

export type DeleteNotionIntegrationResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

function revalidateNotionScope(roomId: number) {
  // ⚠️ 연동 설정은 `/workspaces/manage?room={roomId}&tab=integrations` 경로.
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

/**
 * 노션 OAuth 시작 — 명세 `POST /api/v1/rooms/{roomId}/integrations/notion/authorize`.
 *
 * BE 가 Notion OAuth URL 을 생성해 돌려준다. 호출부(Client) 는 받은 `authorizeUrl` 로
 * `window.location.href` 이동하면, 노션 콜백이 BE `/integrations/notion/callback` 을 치고,
 * BE 가 FE 설정 화면으로 다시 리다이렉트한다 (성공 or `?notion=error&code=...`).
 */
export async function authorizeNotionAction(input: unknown): Promise<AuthorizeNotionResult> {
  const parsed = roomOnlySchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId } = parsed.data;

  if (isMock) {
    return { kind: "error", message: "목 모드에서는 노션 연결을 실행할 수 없어요." };
  }

  try {
    const res = await api<{ authorizeUrl: string }>(
      `/api/v1/rooms/${roomId}/integrations/notion/authorize`,
      { method: "POST" },
    );
    if (!res.authorizeUrl) {
      return { kind: "error", message: "노션 인증 URL 을 받아오지 못했습니다." };
    }
    return { kind: "ok", authorizeUrl: res.authorizeUrl };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "노션 연결을 시작하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/**
 * 노션 내보내기 설정 — 명세 `PUT /api/v1/rooms/{roomId}/integrations/notion`.
 * targetDatabaseId 는 `listNotionDatabases` 가 돌려준 DB id 중 하나.
 */
export async function updateNotionIntegrationAction(
  input: unknown,
): Promise<UpdateNotionIntegrationResult> {
  const parsed = updateNotionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { roomId, targetDatabaseId, exportMode } = parsed.data;

  if (isMock) {
    revalidateNotionScope(roomId);
    return {
      kind: "ok",
      integration: {
        connected: true,
        workspaceName: "목 워크스페이스",
        targetDatabase: { id: targetDatabaseId, title: "목 DB" },
        exportMode,
        enabled: true,
        tokenExpired: false,
      },
    };
  }

  try {
    const res = await api<NotionIntegration>(
      `/api/v1/rooms/${roomId}/integrations/notion`,
      { method: "PUT", json: { targetDatabaseId, exportMode } },
    );
    revalidateNotionScope(roomId);
    return { kind: "ok", integration: res };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) {
      if (e.code === "INTEGRATION_NOTION_DATABASE_NOT_FOUND") {
        return { kind: "database_not_found", message: e.message };
      }
      if (e.code === "INTEGRATION_NOTION_AUTH_EXPIRED") {
        return { kind: "auth_expired", message: e.message };
      }
      return { kind: "error", message: e.message };
    }
    return { kind: "error", message: "노션 설정 저장에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/**
 * 수동 내보내기 — 명세 `POST /api/v1/rooms/{roomId}/integrations/notion/exports`.
 *
 * ⚠️ 응답은 SUCCESS 또는 FAILED 모두 200 으로 떨어진다 (FAILED 는 `errorMessage` 가 있는
 *    ExportResponse). 액션은 둘 다 `kind: "ok"` 로 돌려주고 호출부가 `export.status` 로 분기.
 *    BE 가 거부해 ApiError 를 던지는 건 **권한·설정 누락 등 사전 조건 실패** 케이스.
 */
export async function exportNotionAction(input: unknown): Promise<ExportNotionResult> {
  const parsed = exportNotionSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId, sessionId } = parsed.data;

  if (isMock) {
    return { kind: "error", message: "목 모드에서는 노션 내보내기를 실행할 수 없어요." };
  }

  try {
    const res = await api<NotionExport>(
      `/api/v1/rooms/${roomId}/integrations/notion/exports`,
      { method: "POST", json: { sessionId } },
    );
    revalidateNotionScope(roomId);
    return { kind: "ok", export: res };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "노션 내보내기에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 노션 연동 해제 — 명세 `DELETE /api/v1/rooms/{roomId}/integrations/notion`. */
export async function deleteNotionIntegrationAction(
  input: unknown,
): Promise<DeleteNotionIntegrationResult> {
  const parsed = roomOnlySchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  const { roomId } = parsed.data;

  if (isMock) {
    revalidateNotionScope(roomId);
    return { kind: "ok" };
  }

  try {
    await api(
      `/api/v1/rooms/${roomId}/integrations/notion`,
      { method: "DELETE" },
    );
    revalidateNotionScope(roomId);
    return { kind: "ok" };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return { kind: "error", message: "노션 연동 해제에 실패했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}
