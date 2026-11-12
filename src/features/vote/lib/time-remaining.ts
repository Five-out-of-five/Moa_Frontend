/**
 * 투표 카드 하단의 "6시간 남음" / "2일 남음" 문구.
 *
 * ⚠️ 서버가 +09:00 (KST) 로 내려 주므로 **변환 없이** 그대로 Date 로 파싱한다 (회의 공통 규칙).
 */
export function timeRemainingUntil(deadlineAt: string): string {
  const diffMs = new Date(deadlineAt).getTime() - Date.now();
  if (diffMs <= 0) return "마감됨";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}분 남음`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 남음`;

  const days = Math.floor(hours / 24);
  return `${days}일 남음`;
}
