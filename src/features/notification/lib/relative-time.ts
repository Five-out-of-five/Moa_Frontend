/**
 * ISO-8601 시각을 "방금", "3분 전", "2시간 전" 같은 **상대 시각** 문자열로 바꾼다.
 *
 * ⚠️ 알림 드롭다운처럼 시각 정보가 보조적인 자리에만 쓴다. 정확한 시각(목록 상세 등)
 *    은 toLocaleString 으로 직접 포매팅한다.
 * ⚠️ 하루 이상 전은 "yyyy-MM-dd" 로 떨어뜨린다 — "15일 전" 같은 표시는 애매해서 날짜를
 *    그대로 보여 주는 쪽이 읽기 쉽다.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const target = new Date(iso);
  const diffSec = Math.max(0, Math.floor((now.getTime() - target.getTime()) / 1000));

  if (diffSec < 60) return "방금";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  // 하루 이상은 날짜 그대로
  return iso.slice(0, 10);
}
