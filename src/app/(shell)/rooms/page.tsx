/**
 * `/rooms` — 셸 라우트 그룹의 **동작 확인용** 임시 페이지.
 *
 * ⚠️ 이 페이지는 **공용 레이아웃이 깔렸는지 눈으로 보기 위한 자리** 다.
 *    방 목록 실제 구현은 담당자 티켓(features/room) 에서 한다 — 그때 이 placeholder 를
 *    삭제한다.
 */
export default function RoomsPlaceholderPage() {
  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        방 목록 (placeholder)
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        공용 레이아웃이 깔리는지 확인용 임시 페이지입니다. 실제 방 목록은 담당자가 구현합니다.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => i + 1).map((n) => (
          <article
            key={n}
            className="bg-card border-border rounded-[var(--radius-card)] border p-5 shadow-sm"
          >
            <div className="text-muted-foreground text-xs">방 #{n}</div>
            <div className="text-foreground mt-1 text-lg font-semibold">
              샘플 방 {n}
            </div>
            <div className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Navy Teal Pro 토큰이 잘 적용되는지 확인하는 샘플 카드입니다.
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
