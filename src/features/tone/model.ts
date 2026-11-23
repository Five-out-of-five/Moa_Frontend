import type { ToneMode } from "@/types/db";

export const TONE_MODES = [
  { value: "OFF", label: "사용 안 함", description: "검토 기능을 사용하지 않아요." },
  { value: "POLISH", label: "다듬기", description: "의미를 유지하며 부드럽게 다듬어요." },
  { value: "POLITE", label: "공손하게", description: "상대방을 존중하는 정중한 표현을 제안해요." },
] as const;
export type ToneTarget =
  | { roomId: number; kind: "CARD"; sessionId: number; cardId?: number }
  | { roomId: number; kind: "CHAT"; channelId: number };
export type ToneResult =
  { ok: true; suggestion: string; needsChange: boolean } | { ok: false; error: string };
export type ToneSettingsResult = { saved?: boolean; mode?: ToneMode; error?: string };
