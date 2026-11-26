import type { RoomWidget } from "@/types/db";

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
export type AiReference = { id: number; title: string };
export type AiReferences = { cards: AiReference[]; tasks: AiReference[]; votes: AiReference[] };
export type AiMessage = { id: string; question: string; answer: string; state: "streaming" | "complete" | "stopped" | "failed"; createdAt: string; references?: AiReferences };
export type AiHistory = { items: AiMessage[]; hasNext: boolean; nextCursor: string | null };
export type AiQuota = { feature: string; used: number; limit: number; resetAt?: string };
export type RecommendedWidget = Pick<RoomWidget, "widgetType" | "x" | "y"> & { w: number; h: number };
export type LayoutProposal = { widgets: RecommendedWidget[]; reason: string; mockId?: string };
export type MeetingSummary = { id: string; text: string; sessionTitles: string[]; requestedBy: number; savedCardId: number | null; createdAt: string };
