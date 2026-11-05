import { isMock } from "@/mocks/config";

/**
 * 임시 홈 — 세팅 검증용.
 *
 * FE 초기 세팅 직후 이 화면만으로 "clone → npm install → npm run dev" 가 통과하는지 확인한다.
 * 실제 랜딩/대시보드는 라우트 그룹 구성 후 (public)/(shell) 로 이동한다.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">MOA Frontend</h1>
      <p className="text-muted-foreground">
        팀 오점만점 · MOA 애자일 그룹웨어 프론트엔드. 세팅 검증용 임시 페이지.
      </p>
      <section className="rounded-lg border p-5">
        <h2 className="mb-2 text-sm font-semibold">환경</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Mock 모드</dt>
          <dd>
            <code className="rounded bg-muted px-1.5 py-0.5">
              isMock = {String(isMock)}
            </code>
          </dd>
          <dt className="text-muted-foreground">Node</dt>
          <dd>&gt;= 22</dd>
        </dl>
      </section>
      <section className="rounded-lg border p-5 text-sm">
        <h2 className="mb-2 font-semibold">다음 단계</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>라우트 그룹 구성 ((public) / (shell) / api)</li>
          <li>도메인 features/ 생성 (room / widget / idea / task / vote / mood / briefing / mediation)</li>
          <li>목 데이터 시드 + 각 도메인 server.ts + actions.ts</li>
        </ol>
      </section>
    </main>
  );
}
