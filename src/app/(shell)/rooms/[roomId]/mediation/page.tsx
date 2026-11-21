import { ArrowLeft, ArrowRight, Scale } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { IdeaBoardLive } from "@/features/idea/IdeaBoardLive";
import { getIdeaBoard } from "@/features/idea/server";
import { CompromiseEditor, DismissConflict } from "@/features/mediation/MediationControls";
import { MEDIATION_FILTERS } from "@/features/mediation/model";
import { getMediationBoard } from "@/features/mediation/server";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import type { IdeaCard } from "@/types/db";

export default async function MediationPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>; searchParams: Promise<{ conflict?: string; filter?: string }>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();
  const id = entry.room.id;
  const board = await getMediationBoard(id);
  const idea = await getIdeaBoard(id);
  const sourceHref = (card: IdeaCard) => `/rooms/${id}/boards/idea?${idea.history.some((session) => session.id === card.sessionId) ? `session=${card.sessionId}&` : ""}briefingFocus=${card.id}`;
  const base = `/rooms/${id}/mediation`;
  const filter = MEDIATION_FILTERS.find(({ key }) => key === query.filter)?.key ?? "all";
  const items = board?.items.filter((item) => filter === "all" || item.state === filter) ?? [];
  const selected = items.find((item) => String(item.id) === query.conflict) ?? items.find((item) => item.state === "OPEN") ?? items[0];
  const left = board?.cards.find(({ id }) => id === selected?.leftCardId);
  const right = board?.cards.find(({ id }) => id === selected?.rightCardId);
  const draft = board?.drafts.find((item) => item.conflictId === selected?.id && item.adoptedCardId === null);
  const itemLink = (conflict: number) => `${base}?conflict=${conflict}${filter !== "all" ? `&filter=${filter}` : ""}`;
  const list = (state: "dismissed" | "visible") => items.filter((item) => state === "dismissed" ? item.state === "DISMISSED" : item.state !== "DISMISSED").map((item) => (
    <li key={item.id}>
      <Link href={itemLink(item.id)} aria-current={selected?.id === item.id ? "page" : undefined}
        className="hover:bg-muted aria-[current=page]:bg-secondary block space-y-2 rounded p-3">
        <span className="text-primary text-xs">{MEDIATION_FILTERS.find(({ key }) => key === item.state)?.label}</span>
        <p className="line-clamp-2 text-xs font-semibold">{item.leftCardTitle} ↔ {item.rightCardTitle}</p>
        <p className="text-muted-foreground line-clamp-2 text-xs">{item.summary}</p>
      </Link>
    </li>
  ));
  return (
    <section className="mx-auto max-w-7xl space-y-4">
      {board && <IdeaBoardLive roomId={id} revision={board.revision} />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-primary text-xs">워크스페이스</p><h1 className="mt-1 text-2xl font-bold">인공지능 중재</h1>
          <p className="text-muted-foreground mt-1 text-sm">충돌하는 의견을 살펴보고 팀이 결정할 절충안을 준비하세요.</p></div>
        <Button variant="outline" asChild><Link href={`/rooms/${id}`}><ArrowLeft aria-hidden="true" />대시보드로 돌아가기</Link></Button>
      </header>
      {!board ? <p className="text-muted-foreground">중재 상세 기능은 현재 제공되지 않아요.</p>
        : !board.enabled ? <p className="bg-card border-border rounded-card border p-5 text-sm">대시보드에 중재 위젯을 추가하면 충돌을 확인할 수 있어요.</p>
          : <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside aria-label="충돌 목록" className="bg-card border-border rounded-card space-y-3 border p-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Scale aria-hidden="true" className="size-4" />감지된 의견 충돌 {board.items.length}개</h2>
              <nav aria-label="충돌 상태" className="flex flex-wrap gap-1">
                {MEDIATION_FILTERS.map(({ key, label }) => <Link key={key} href={key === "all" ? base : `${base}?filter=${key}`}
                  aria-current={filter === key ? "page" : undefined} className="border-border aria-[current=page]:bg-secondary rounded border px-2 py-1 text-xs">{label}</Link>)}
              </nav>
              <ul className="divide-border divide-y">{list("visible")}</ul>
              {items.some(({ state }) => state === "DISMISSED") && <details><summary className="text-muted-foreground cursor-pointer text-xs">해제된 충돌</summary><ul>{list("dismissed")}</ul></details>}
              {!items.length && <p className="text-muted-foreground py-4 text-sm">표시할 충돌이 없어요.</p>}
            </aside>
            <div className="bg-card border-border rounded-card min-h-80 space-y-4 border p-4">
              {selected && left && right ? <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-primary text-xs">{MEDIATION_FILTERS.find(({ key }) => key === selected.state)?.label}</span>
                  {selected.state === "OPEN" && <DismissConflict roomId={id} conflictId={selected.id} />}
                </div>
                <div className="grid gap-3 md:grid-cols-2"><OriginalCard card={left} href={sourceHref(left)} /><OriginalCard card={right} href={sourceHref(right)} /></div>
                <section className="bg-secondary/40 rounded-control space-y-2 p-3">
                  <h2 className="text-sm font-semibold">충돌 감지 설명</h2><p className="text-muted-foreground text-sm">{selected.summary}</p>
                </section>
                {selected.state === "OPEN" && <CompromiseEditor roomId={id} conflictId={selected.id} draft={draft} title="두 의견을 함께 반영한 절충안" />}
                {selected.state === "RESOLVED" && <p className="text-success text-sm">절충안이 채택되어 아이디어 카드로 등록됐어요.</p>}
                {selected.state === "DISMISSED" && <p className="text-muted-foreground text-sm">해제한 충돌이에요. 동일한 카드 쌍의 감지는 다시 요청하지 않아요.</p>}
              </> : <p className="text-muted-foreground text-sm">확인할 충돌을 선택해 주세요.</p>}
            </div>
          </div>}
    </section>
  );
}

function OriginalCard({ card, href }: { card: IdeaCard; href: string }) {
  return <article className="border-border rounded-control flex min-w-0 flex-col gap-3 border p-4">
    <p className="text-muted-foreground text-xs">원본 의견</p><h2 className="text-sm font-semibold break-words">{card.title}</h2>
    <p className="text-muted-foreground flex-1 text-sm break-words whitespace-pre-wrap">{card.content}</p>
    <div className="border-border flex items-center justify-between gap-2 border-t pt-3">
      <span className="text-muted-foreground min-w-0 truncate text-xs">{card.author.displayName}</span>
      <Button asChild size="sm" variant="secondary">
        <Link href={href} aria-label={`${card.title} 원본 카드 보기`}>원본 카드 보기<ArrowRight aria-hidden="true" className="size-3.5" /></Link>
      </Button>
    </div>
  </article>;
}
