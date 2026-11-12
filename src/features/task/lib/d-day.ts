/**
 * `dueDate` ("yyyy-MM-dd") 로부터 현재 로컬 자정 기준 남은/지난 일수를 계산.
 *
 * ⚠️ `new Date("2026-11-12")` 는 UTC 자정으로 파싱되어, KST (UTC+9) 환경에선
 *    로컬 날짜가 하루 전으로 넘어가 `dDay` 가 오답이 되는 버그가 있었다 (CodeRabbit).
 *    여기선 **year/month/day 를 수동 파싱**해 로컬 Date 로 구성하고 둘 다 자정에
 *    맞춰 비교한다.
 */
export function computeDDay(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const [yStr, mStr, dStr] = dueDate.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Math.round(
    (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
}

/** 상태를 함께 넘기면 `overdue` 도 일관되게 계산 (`DONE` 은 overdue 안 됨). */
export function computeOverdue(
  dueDate: string | null,
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE",
): boolean {
  if (status === "DONE") return false;
  const dDay = computeDDay(dueDate);
  return dDay !== null && dDay < 0;
}
