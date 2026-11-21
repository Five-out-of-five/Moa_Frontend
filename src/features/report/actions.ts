"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getManagedRoom } from "@/features/room/management/server";
import { api, ApiError } from "@/lib/api";
import { getApiAccountContext } from "@/lib/api-account";
import { isAuthor } from "@/lib/permission";
import { adminReportsStore } from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import { ideaCards } from "@/mocks/db";
import type { components } from "@/types/api";

import type { ReportResult } from "./model";

const schema = z.object({
  roomId: z.number().int().positive(),
  targetId: z.number().int().positive(),
  targetType: z.enum(["CARD", "COMMENT", "MESSAGE"]),
  reason: z.enum(["ABUSE", "SPAM", "INAPPROPRIATE_FILE", "PRIVACY", "ETC"]),
  detail: z.string().trim().max(500),
});

export async function submitReportAction(_: ReportResult, form: FormData): Promise<ReportResult> {
  const parsed = schema.safeParse({
    roomId: Number(form.get("roomId")),
    targetId: Number(form.get("targetId")),
    targetType: form.get("targetType"),
    reason: form.get("reason"),
    detail: String(form.get("detail") ?? ""),
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      reasonError: fields.reason ? "신고 사유를 선택해 주세요." : undefined,
      detailError: fields.detail ? "상세 내용은 500자 이내로 입력해 주세요." : undefined,
      error:
        fields.roomId || fields.targetId || fields.targetType
          ? "신고 대상을 확인해 주세요."
          : undefined,
    };
  }
  const { roomId, ...request } = parsed.data;
  try {
    if (isMock) {
      const context = await getManagedRoom(roomId);
      if (!context) return { error: "이 방의 콘텐츠를 신고할 권한이 없어요." };
      if (request.targetType !== "CARD") return { error: "이 대상의 신고는 아직 지원하지 않아요." };
      const card = ideaCards.find(
        ({ id, roomId: cardRoom }) => id === request.targetId && cardRoom === roomId,
      );
      if (!card) return { error: "삭제되었거나 찾을 수 없는 카드예요." };
      if (isAuthor(context.account, card.author))
        return { error: "본인의 카드는 신고할 수 없어요." };
      // 스냅샷은 클라이언트가 보낸 미리보기가 아닌 서버 원본으로 만든다.
      const entries = [...adminReportsStore.values()];
      if (
        entries.some(
          (entry) =>
            entry.reporterAccountId === context.account.id &&
            entry.targetType === request.targetType &&
            entry.targetId === card.id,
        )
      )
        return { error: "이미 신고한 카드예요." };
      const reportId = entries.reduce((max, entry) => Math.max(max, entry.reportId), 0) + 1;
      adminReportsStore.set(reportId, {
        reportId,
        targetId: card.id,
        targetType: request.targetType,
        reason: request.reason,
        detail: request.detail,
        status: "RECEIVED",
        reporterAccountId: context.account.id,
        targetAccountId: card.author.accountId,
        roomId,
        roomName: context.room.name,
        snapshot: `${card.title}\n${card.content}`,
        targetDeleted: false,
        createdAt: new Date().toISOString(),
        action: null,
        actionReason: null,
        handledByAccountId: null,
        handledAt: null,
        falseReport: false,
      });
    } else {
      const { init, query, accountId } = await getApiAccountContext();
      if (request.targetType === "CARD") {
        const card = await api<components["schemas"]["IdeaCardDetailResponse"]>(
          `/api/v1/rooms/${roomId}/idea-cards/${request.targetId}?${query}`,
          init,
        );
        if (!card?.cardId || !card.writer?.accountId)
          return { error: "삭제되었거나 찾을 수 없는 카드예요." };
        if (
          isAuthor(
            { id: accountId },
            {
              accountId: card.writer.accountId,
              displayName: "",
              profileImageUrl: null,
              memberStatus: "ACTIVE",
            },
          )
        )
          return { error: "본인의 카드는 신고할 수 없어요." };
      } else return { error: "이 대상의 신고는 아직 지원하지 않아요." };
      await api<components["schemas"]["ReportResponse"]>(`/api/v1/reports?${query}`, {
        ...init,
        method: "POST",
        json: request,
      });
    }
    revalidatePath("/admin/reports");
    return { saved: true };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }
}
