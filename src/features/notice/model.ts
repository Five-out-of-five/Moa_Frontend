import type { components } from "@/types/api";

type Schemas = components["schemas"];
export type NoticeSummary = Schemas["NoticeSummaryResponse"];
export type NoticeDetail = Schemas["NoticeResponse"];
export type NoticeBannerData = Schemas["Banner"];

export const NOTICE_LABELS = { GENERAL: "일반", MAINTENANCE: "점검", URGENT: "긴급" } as const;

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

export function formatNoticeDate(value?: string) {
  const date = new Date(value ?? "");
  return Number.isFinite(date.getTime()) ? dateTime.format(date) : null;
}
