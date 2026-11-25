import { ArrowLeft, ArrowRight, Scale } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { IdeaBoardLive } from "@/features/idea/IdeaBoardLive";
import { CompromiseEditor, DismissConflict } from "@/features/mediation/MediationControls";
import { MEDIATION_CARD_LABELS, MEDIATION_FILTERS, MEDIATION_STATUS_LABELS, type MediationCard, needsMediation } from "@/features/mediation/model";
import { getMediationBoard, getMediationDetail } from "@/features/mediation/server";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";

const format = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });

export default async function MediationPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>; searchParams: Promise<{ conflict?: string; filter?: string }>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();
  const id = entry.room.id;
  const base = `/rooms/${id}/mediation`;
  const filter = MEDIATION_FILTERS.find(({ key }) => key === query.filter)?.key ?? "all";
  const all = getMediationBoard(id);
  const [board, unfiltered] = await Promise.all([filter === "all" ? all : getMediationBoard(id, filter), all]);
  const { items } = board;
  const selected = unfiltered.items.find((item) => String(item.id) === query.conflict) ?? items.find(needsMediation)
    ?? items.find(({ status }) => status !== "DISMISSED") ?? items[0];
  const detail = selected ? await getMediationDetail(id, selected.id) : null;
  const itemLink = (conflict: number) => `${base}?conflict=${conflict}${filter !== "all" ? `&filter=${filter}` : ""}`;
  const list = (dismissed: boolean) => items.filter(({ status }) => (status === "DISMISSED") === dismissed).map((item) => (
    <li key={item.id}>
      <Link href={itemLink(item.id)} aria-current={selected?.id === item.id ? "page" : undefined}
        className="hover:bg-muted aria-[current=page]:bg-secondary block space-y-2 rounded p-3">
        <div className="flex flex-wrap justify-between gap-1 text-xs">
          <span className="text-primary">{MEDIATION_STATUS_LABELS[item.status]}{item.adoptedCardId !== null && " · 채택됨"}</span>
          {item.detectedAt && Number.isFinite(Date.parse(item.detectedAt)) &&
            <time dateTime={item.detectedAt} className="text-muted-foreground">{format.format(new Date(item.detectedAt))}</time>}
        </div>
        <p className="line-clamp-2 text-xs font-semibold">{item.leftCardTitle} ↔ {item.rightCardTitle}</p>
      </Link>
    </li>
  ));
  return (
    <section className="mx-auto max-w-7xl space-y-4">
      {board.enabled && board.revision !== null && <IdeaBoardLive roomId={id} revision={board.revision} />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-primary text-xs">워크스페이스</p><h1 className="mt-1 text-2xl font-bold">인공지능 중재</h1>
          {board.enabled && <p className="text-muted-foreground mt-1 text-sm">확인이 필요한 충돌 {unfiltered.items.filter(needsMediation).length}개</p>}</div>
        <Button variant="outline" asChild><Link href={`/rooms/${id}`}><ArrowLeft aria-hidden="true" />대시보드로 돌아가기</Link></Button>
      </header>
      {!board.enabled ? <p className="bg-card border-border rounded-card border p-5 text-sm">대시보드에 중재 위젯을 추가하면 충돌을 확인할 수 있어요.</p>
          : <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside aria-label="충돌 목록" className="bg-card border-border rounded-card space-y-3 border p-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Scale aria-hidden="true" className="size-4" />감지된 의견 충돌 {unfiltered.items.length}개</h2>
              <nav aria-label="충돌 상태" className="flex flex-wrap gap-1">
                {MEDIATION_FILTERS.map(({ key, label }) => <Link key={key} href={key === "all" ? base : `${base}?filter=${key}`}
                  aria-current={filter === key ? "page" : undefined} className="border-border aria-[current=page]:bg-secondary rounded border px-2 py-1 text-xs">{label}</Link>)}
              </nav>
              <ul className="divide-border divide-y">{list(false)}</ul>
              {items.some(({ status }) => status === "DISMISSED") && <details key={selected?.id} open={filter === "DISMISSED" || (selected?.status === "DISMISSED" && String(selected.id) === query.conflict)}>
                <summary className="text-muted-foreground cursor-pointer text-xs">해제된 충돌</summary><ul>{list(true)}</ul>
              </details>}
              {!items.length && <p className="text-muted-foreground py-4 text-sm">표시할 충돌이 없어요.</p>}
            </aside>
            <div className="bg-card border-border rounded-card min-h-80 space-y-4 border p-4">
              {selected && detail ? <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-primary text-xs">{MEDIATION_STATUS_LABELS[detail.status]}</span>
                  {detail.status !== "DISMISSED" && <DismissConflict key={selected.id} roomId={id} conflictId={selected.id} />}
                </div>
                <div className="grid gap-3 md:grid-cols-2"><OriginalCard card={detail.left} /><OriginalCard card={detail.right} /></div>
                <section className="bg-secondary/40 rounded-control space-y-2 p-3">
                  <h2 className="text-sm font-semibold">충돌 감지 설명</h2><p className="text-muted-foreground text-sm">{detail.reason || "등록된 설명이 없어요."}</p>
                </section>
                {detail.adoptedCardId !== null && <div className="flex flex-wrap items-center gap-2">
                  <p className="text-success text-sm">절충안이 채택되어 아이디어 카드로 등록됐어요.</p>
                  {detail.adoptedHref && <Button asChild size="sm" variant="outline"><Link href={detail.adoptedHref}>채택된 카드 보기<ArrowRight aria-hidden="true" /></Link></Button>}
                </div>}
                {(detail.draft || (detail.status !== "DISMISSED" && detail.adoptedCardId === null)) &&
                  <CompromiseEditor key={selected.id} roomId={id} conflictId={selected.id} draft={detail.draft} canAdopt={detail.adoptedCardId === null} />}
              </> : <p className="text-muted-foreground text-sm">{selected ? "이 충돌을 더 이상 확인할 수 없어요." : "확인할 충돌을 선택해 주세요."}</p>}
            </div>
          </div>}
    </section>
  );
}

function OriginalCard({ card }: { card: MediationCard | null }) {
  if (!card) return <p className="border-border rounded-control text-muted-foreground border p-4 text-sm">원본 카드를 확인할 수 없어요.</p>;
  return <article className="border-border rounded-control flex min-w-0 flex-col gap-3 border p-4">
    <p className="text-muted-foreground text-xs">원본 의견{card.cardType && ` · ${MEDIATION_CARD_LABELS[card.cardType]}`}</p><h2 className="text-sm font-semibold break-words">{card.title}</h2>
    <p className="text-muted-foreground flex-1 text-sm break-words whitespace-pre-wrap">{card.content}</p>
    <div className="border-border flex items-center justify-between gap-2 border-t pt-3">
      <span className="text-muted-foreground min-w-0 truncate text-xs">{card.author}</span>
      <Button asChild size="sm" variant="secondary">
        <Link href={card.href} aria-label={`${card.title} 원본 카드 보기`}>원본 카드 보기<ArrowRight aria-hidden="true" className="size-3.5" /></Link>
      </Button>
    </div>
  </article>;
}
