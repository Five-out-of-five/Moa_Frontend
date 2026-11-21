import type { components } from "@/types/api";

export type ReportRequest = components["schemas"]["ReportCreateRequest"];
export type ReportTarget = {
  roomId: number;
  id: number;
  type: ReportRequest["targetType"];
  author: string;
  content: string;
};
export type ReportResult = {
  saved?: boolean;
  error?: string;
  reasonError?: string;
  detailError?: string;
};
export const REPORT_REASONS = [
  { value: "ABUSE", label: "욕설·비방" },
  { value: "SPAM", label: "스팸·광고" },
  { value: "INAPPROPRIATE_FILE", label: "부적절한 파일" },
  { value: "PRIVACY", label: "개인정보 노출" },
  { value: "ETC", label: "기타" },
] as const;
