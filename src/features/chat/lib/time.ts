/**
 * 채팅 UI 가 쓰는 시간 포맷·그룹 키 유틸.
 *
 * ⚠️ **SSR / 1차 CSR 은 UTC 기준, mount 후엔 사용자 로컬 TZ 기준** 으로 분기해 쓴다.
 *   Next 15 는 client component 도 1차 HTML 을 서버에서 생성하므로, 로컬 TZ 포맷을
 *   그대로 쓰면 서버·클라 결과가 다를 때 hydration 경고가 뜨고, 날짜 구분선이 KST
 *   23:59 ↔ 00:01 엣지에서 누락/중복될 수 있다 (CodeRabbit).
 *
 *   `MessageList` 는 `useEffect` 로 `mounted` 를 true 로 전환하고, 그 플래그를 포맷터와
 *   그룹 키 함수에 `useLocal` 로 전달해 **mount 전엔 UTC, 후엔 로컬** 으로 다시 그린다.
 */

/** 그룹 키 — UTC 기준. 서버·1차 CSR 에서 공통으로 쓴다. */
export function toUtcDateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 그룹 키 — 사용자 로컬 TZ. mount 후 재그룹용. */
export function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 메시지 작성 시각 포맷 — "오전 11:30" / "오후 2:17".
 * @param useLocal mount 전 (SSR/1차 CSR) 에는 false → UTC 기준. 이후 true 로 로컬 전환.
 */
export function formatTime(iso: string, useLocal: boolean): string {
  const d = new Date(iso);
  const hour = useLocal ? d.getHours() : d.getUTCHours();
  const minuteNum = useLocal ? d.getMinutes() : d.getUTCMinutes();
  const minute = String(minuteNum).padStart(2, "0");
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}:${minute}`;
}

/**
 * 날짜 구분선 라벨 — mount 전엔 "11월 16일 (일)" (UTC), 후엔 "오늘 / 어제 / N월 N일 (요일)" (로컬).
 *
 * ⚠️ "오늘 / 어제" 는 **로컬 기준에서만** 의미가 있다 (사용자가 체감하는 "오늘"). 서버
 *   UTC 기준으로 "오늘" 이라 표시하면 KST 사용자에게는 "어제 메시지" 로 보일 수 있어, SSR
 *   단계에선 상대 라벨을 쓰지 않는다.
 */
export function formatDateDivider(iso: string, useLocal: boolean): string {
  const d = new Date(iso);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;

  if (!useLocal) {
    const weekday = weekdays[d.getUTCDay()];
    return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${weekday})`;
  }

  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "오늘";
  if (diffDays === -1) return "어제";
  const weekday = weekdays[d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday})`;
}
