import type { components } from "@/types/api";

type Schemas = components["schemas"];
export type MediationStatus = NonNullable<Schemas["ConflictSummaryResponse"]["status"]>;
export type MediationResult = { saved?: boolean; error?: string };
export const MEDIATION_STATUS_LABELS = {
  DETECTED: "감지됨", PROPOSED: "제안됨", DISMISSED: "해제됨", REDETECTED: "재감지됨",
} satisfies Record<MediationStatus, string>;
export const MEDIATION_FILTERS = [
  { key: "all", label: "전체" }, { key: "DETECTED", label: MEDIATION_STATUS_LABELS.DETECTED },
  { key: "PROPOSED", label: MEDIATION_STATUS_LABELS.PROPOSED }, { key: "DISMISSED", label: MEDIATION_STATUS_LABELS.DISMISSED },
  { key: "REDETECTED", label: MEDIATION_STATUS_LABELS.REDETECTED },
] as const;

export type MediationItem = {
  id: number; status: MediationStatus; leftCardTitle: string; rightCardTitle: string; detectedAt: string | null; adoptedCardId: number | null;
};
export type MediationDraft = { id: number; title: string; content: string; cardType: "AGENDA" | "TRY" };
export type MediationCard = { title: string; content: string; author: string; cardType?: Schemas["IdeaCardDetailResponse"]["cardType"]; href: string };
export type MediationDetail = {
  status: MediationStatus; reason: string; left: MediationCard | null; right: MediationCard | null;
  draft: MediationDraft | null; adoptedCardId: number | null; adoptedHref: string | null;
};

export function needsMediation({ status, adoptedCardId }: MediationItem) {
  return status !== "DISMISSED" && adoptedCardId === null;
}

export function ideaMediationHref(roomId: number, cardId: number, archivedSessionId?: number) {
  return `/rooms/${roomId}/boards/idea?${archivedSessionId ? `session=${archivedSessionId}&` : ""}open=${cardId}&briefingFocus=${cardId}`;
}

export const MEDIATION_CARD_LABELS = { AGENDA: "안건", KEEP: "유지할 점", PROBLEM: "문제점", TRY: "시도할 점" } as const;
