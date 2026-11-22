/**
 * 감사 로그의 `actionType` / `targetType` 은 BE 가 string 으로 돌려주지만 운영 화면에서는
 * **알려진 값에 한글 라벨**을 입혀 가독성을 높인다. 모르는 값은 원문 그대로 노출 (운영자가
 * 새 enum 을 즉시 알아채도록).
 *
 * ⚠️ 라벨 수정은 **이 한 곳만**. 테이블·필터가 참조한다.
 */

// 키는 BE `AdminAuditRecorder` 호출부가 쓰는 actionType 문자열과 정확히 일치시킨다.
const ACTION_TYPE_LABELS: Record<string, string> = {
  ROLE_CHANGE: "역할 변경",
  ACCOUNT_SUSPEND: "계정 정지",
  ACCOUNT_RELEASE: "정지 해제",
  REPORT_REVIEW: "신고 담당자 지정",
  REPORT_RESOLVE: "신고 조치 완료",
  REPORT_REJECT: "신고 반려",
  ROOM_INACTIVATE: "방 비활성화",
  ROOM_REACTIVATE: "방 비활성 해제",
  NOTICE_CREATE: "공지 생성",
  NOTICE_UPDATE: "공지 수정",
  NOTICE_DELETE: "공지 삭제",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  ACCOUNT: "회원",
  REPORT: "신고",
  ROOM: "방",
  NOTICE: "공지",
};

export function auditActionTypeLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return (Object.hasOwn(ACTION_TYPE_LABELS, code)
    ? ACTION_TYPE_LABELS[code]
    : code);
}

export function auditTargetTypeLabel(code: string | undefined | null): string {
  if (!code) return "-";
  return (Object.hasOwn(TARGET_TYPE_LABELS, code)
    ? TARGET_TYPE_LABELS[code]
    : code);
}

/** 필터 드롭다운에서 보여 줄 `targetType` 후보. 운영 중에 늘어나면 여기에 추가. */
export const AUDIT_TARGET_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ACCOUNT", label: TARGET_TYPE_LABELS.ACCOUNT },
  { value: "REPORT", label: TARGET_TYPE_LABELS.REPORT },
  { value: "ROOM", label: TARGET_TYPE_LABELS.ROOM },
  { value: "NOTICE", label: TARGET_TYPE_LABELS.NOTICE },
];

/**
 * `actionType` 자동 완성 데이터리스트. 자유 입력을 허용하되 흔한 값은 기본 노출.
 */
export const AUDIT_ACTION_TYPE_SUGGESTIONS: string[] = Object.keys(
  ACTION_TYPE_LABELS,
);
