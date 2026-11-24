"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { CHANNEL_MESSAGES, CHAT_CHANNELS } from "@/features/chat/mock-seed";
import { getIdeaDiscussions } from "@/features/idea/server";
import { getManagedRoom } from "@/features/room/management/server";
import { listRoomMembers } from "@/features/room/server";
import { api, ApiError } from "@/lib/api";
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
      const target = await getMockReportTarget(roomId, request.targetType, request.targetId);
      if (!target) return { error: "삭제되었거나 찾을 수 없는 콘텐츠예요." };
      if (isAuthor(context.account, target.author)) return { error: "본인의 콘텐츠는 신고할 수 없어요." };
      // 스냅샷은 클라이언트가 보낸 미리보기가 아닌 서버 원본으로 만든다.
      const entries = [...adminReportsStore.values()];
      if (
        entries.some(
          (entry) =>
            entry.reporterAccountId === context.account.id &&
            entry.targetType === request.targetType &&
            entry.targetId === request.targetId,
        )
      )
        return { error: "이미 신고한 내용입니다." };
      const reportId = entries.reduce((max, entry) => Math.max(max, entry.reportId), 0) + 1;
      adminReportsStore.set(reportId, {
        reportId,
        targetId: request.targetId,
        targetType: request.targetType,
        reason: request.reason,
        detail: request.detail,
        status: "RECEIVED",
        reporterAccountId: context.account.id,
        targetAccountId: target.author.accountId,
        roomId,
        roomName: context.room.name,
        snapshot: target.snapshot,
        targetDeleted: false,
        createdAt: new Date().toISOString(),
        action: null,
        actionReason: null,
        handledByAccountId: null,
        handledAt: null,
        falseReport: false,
      });
    } else {
      await api<components["schemas"]["ReportResponse"]>("/api/v1/reports", {
        cache: "no-store",
        method: "POST",
        json: { ...request, detail: request.detail || undefined },
      });
    }
    revalidatePath("/admin/reports");
    return { saved: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.code === "COMMON_INVALID_INPUT") {
      const reasonError = error.fields?.find(({ field }) => field === "reason")?.reason;
      const detailError = error.fields?.find(({ field }) => field === "detail")?.reason;
      if (reasonError || detailError) return { reasonError, detailError };
    }
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }
}

async function getMockReportTarget(roomId: number, type: z.infer<typeof schema>["targetType"], targetId: number) {
  const cards = ideaCards.filter((card) => card.roomId === roomId);
  if (type === "CARD") {
    const card = cards.find(({ id }) => id === targetId);
    return card && { author: card.author, snapshot: `${card.title}\n${card.content}` };
  }
  if (type === "COMMENT") {
    const members = await listRoomMembers(roomId);
    const comment = Object.values(getIdeaDiscussions(cards, members)).flatMap(({ comments }) => comments)
      .find(({ id }) => id === targetId);
    if (!comment) return;
    const author = members.find(({ accountId }) => accountId === comment.authorId)
      ?? cards.find(({ author }) => author.accountId === comment.authorId)?.author;
    return author && { author, snapshot: comment.text };
  }
  const message = CHAT_CHANNELS.filter((channel) => channel.roomId === roomId)
    .flatMap(({ id }) => CHANNEL_MESSAGES[id] ?? []).find(({ id }) => id === targetId);
  return message && !message.deleted && !message.isSystem && {
    author: { ...message.author, profileImageUrl: null, memberStatus: "ACTIVE" as const },
    snapshot: message.content,
  };
}
