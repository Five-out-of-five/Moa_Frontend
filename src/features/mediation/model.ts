export type MediationResult = { saved?: boolean; error?: string };
export const MEDIATION_FILTERS = [
  { key: "all", label: "전체" }, { key: "OPEN", label: "감지됨" },
  { key: "RESOLVED", label: "채택됨" }, { key: "DISMISSED", label: "해제됨" },
] as const;
