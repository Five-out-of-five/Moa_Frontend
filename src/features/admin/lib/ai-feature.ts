/**
 * BE `AiFeature` enum 과 한글 표시명 매핑. 통계·로그·필터 등 관리자 화면 전반에서 재사용한다.
 *
 * ⚠️ 라벨 변경은 **이 한 곳만** 고친다 — 테이블·그래프·필터 드롭다운이 전부 이 맵을 참조한다.
 * ⚠️ 모르는 값(명세가 늘어나 BE 가 새 enum 을 돌려줬을 때) 은 **raw 값을 그대로** 보여준다.
 *    임의로 "기타" 로 숨기지 않는다 — 운영자가 미등록 피처를 즉시 알아채야 하기 때문.
 */

export type AiFeatureCode =
  | "ASSISTANT"
  | "SUMMARY"
  | "CONFLICT"
  | "COMPROMISE"
  | "TONE"
  | "LAYOUT"
  | "TASK_RECOMMEND";

const AI_FEATURE_LABELS: Record<AiFeatureCode, string> = {
  ASSISTANT: "AI 어시스턴트",
  SUMMARY: "AI 요약",
  CONFLICT: "충돌 감지",
  COMPROMISE: "중재 절충안",
  TONE: "톤 교정",
  LAYOUT: "레이아웃 제안",
  TASK_RECOMMEND: "업무 추천",
};

export function aiFeatureLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return AI_FEATURE_LABELS[code as AiFeatureCode] ?? code;
}
