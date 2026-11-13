/**
 * `dueDate` ("yyyy-MM-dd") 로부터 **Asia/Seoul (KST, UTC+9) 달력 날짜 기준** 남은/지난
 * 일수를 계산.
 *
 * ⚠️ 이 함수가 돌아가는 Next 서버의 프로세스 타임존이 UTC 일 수도 KST 일 수도 있다
 *    (배포 환경에 따라). 프로세스 로컬 자정을 쓰면 KST 01:00 ~ 09:00 사이에 dDay 가
 *    하루 밀린다 (CodeRabbit). 모든 서버 응답이 +09:00 로 내려오는 프로젝트 공통 규칙에
 *    맞춰 **Asia/Seoul 타임존** 으로 오늘·마감일을 뽑아 비교한다.
 *
 * ⚠️ `dueDate` 는 BE 명세상 KST 달력 기준 "yyyy-MM-dd". 숫자 파싱으로 년·월·일만
 *    꺼내고 로컬 Date 생성자 (타임존 의존) 는 쓰지 않는다 — 대신 **UTC 자정 기준 Date 를
 *    만들고 두 Date 모두 같은 룰로 비교**해 타임존 영향 제거.
 */
const KST_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function todayInKst(): { y: number; m: number; d: number } {
  // en-CA 포맷은 "YYYY-MM-DD" 형식을 보장한다 (ISO-like).
  const parts = KST_PARTS_FORMATTER.format(new Date()).split("-");
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
}

export function computeDDay(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const [yStr, mStr, dStr] = dueDate.split("-");
  const dueY = Number(yStr);
  const dueM = Number(mStr);
  const dueD = Number(dStr);
  if (!Number.isFinite(dueY) || !Number.isFinite(dueM) || !Number.isFinite(dueD)) {
    return null;
  }
  const today = todayInKst();
  // 두 Date 를 같은 규칙(Date.UTC) 로 만들고 UTC 밀리초 차이로 비교 — 프로세스 타임존 영향 제거.
  const todayMs = Date.UTC(today.y, today.m - 1, today.d);
  const dueMs = Date.UTC(dueY, dueM - 1, dueD);
  return Math.round((dueMs - todayMs) / (24 * 60 * 60 * 1000));
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
