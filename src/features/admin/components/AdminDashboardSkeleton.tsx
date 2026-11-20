/**
 * 대시보드 로딩 스켈레톤 — 실제 렌더 구조(헤더 · 전체 지표 · 추이 3개 · AI 사용량 표) 를 그대로
 * 흉내 내 레이아웃 시프트를 줄인다. Tailwind `animate-pulse` 로 가볍게 처리.
 */
export function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <header>
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-60 animate-pulse rounded bg-slate-100" />
      </header>

      <section className="flex flex-col gap-3">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white"
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
      </section>
    </div>
  );
}
