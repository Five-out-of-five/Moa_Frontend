/**
 * BE `AiFeature` enum 과 한글 표시명 매핑. 통계·로그·필터 등 관리자 화면 전반에서 재사용한다.
 *
 * ⚠️ 라벨 표기는 **요구사항 명세서 row 80 "서비스 통계 조회"** 의 enum 컬럼을 정본으로 한다.
 *    "AI 기능: 어시스턴트 / 회의 요약 / 충돌 감지 / 절충안 / 톤앤매너 / 대시보드 구성"
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
  ASSISTANT: "어시스턴트",
  SUMMARY: "회의 요약",
  CONFLICT: "충돌 감지",
  COMPROMISE: "절충안",
  TONE: "톤앤매너",
  LAYOUT: "대시보드 구성",
  // 명세서 통계 섹션엔 아직 등재 안 됨. 피처가 쓰이기 시작하면 명세 업데이트 후 라벨 교체.
  TASK_RECOMMEND: "업무 추천",
};

export function aiFeatureLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return AI_FEATURE_LABELS[code as AiFeatureCode] ?? code;
}
