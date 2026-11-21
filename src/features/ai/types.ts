import type { RoomWidget } from "@/types/db";

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type AiMessage = { id: string; question: string; answer: string; state: "streaming" | "complete" | "stopped" | "failed"; createdAt: string };
export type LayoutProposal = { id: string; widgets: RoomWidget[]; reason: string };
export type MeetingSummary = { id: string; text: string; sources: { id: number; title: string }[] };
