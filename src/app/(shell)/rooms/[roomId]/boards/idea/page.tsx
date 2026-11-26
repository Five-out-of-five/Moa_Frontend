import { ArrowLeft, History, Plus, Square } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { MeetingSummaryLoader } from "@/features/ai/MeetingSummaryLoader";
import { BriefingFocus } from "@/features/briefing/BriefingFocus";
import { readBriefingFocus } from "@/features/briefing/model";
import { IdeaBoard } from "@/features/idea/IdeaBoard";
import { IdeaBoardLive } from "@/features/idea/IdeaBoardLive";
import { CloseIdeaDialog, IdeaCardDialog, StartIdeaDialog } from "@/features/idea/IdeaDialogs";
import { ideaDateTime } from "@/features/idea/model";
import { IDEA_BOARD_EVENTS } from "@/features/idea/realtime-events";
import { getIdeaBoard } from "@/features/idea/server";
import { listMockConflicts } from "@/features/mediation/server";
import { RoomDataRefresh } from "@/features/realtime/RoomDataRefresh";
import { getReportViewerAccountId } from "@/features/report/server";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";

export default async function IdeaBoardPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ session?: string; briefingFocus?: string; historyPage?: string; open?: string }>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();
  const id = entry.room.id;
  const sessionId = query.session === undefined ? undefined : Number(query.session);
  if (sessionId !== undefined && (!Number.isSafeInteger(sessionId) || sessionId < 1)) notFound();
  const historyPage = query.historyPage && /^\d{1,8}$/.test(query.historyPage) ? Number(query.historyPage) : 0;
  const board = await getIdeaBoard(id, sessionId, historyPage);
  const accountId = await getReportViewerAccountId();
  const selected = board.selected;
  if (query.session && !selected) notFound();
  const cards = selected ? board.cards.filter(({ sessionId }) => sessionId === selected.id) : [];
  const openCardId = cards.find(({ id }) => String(id) === query.open)?.id;
  const conflicts = board.usesMockStream ? listMockConflicts(id) : [];
  const conflictByCard = Object.fromEntries(conflicts.filter(({ state }) => state === "OPEN")
    .flatMap((conflict) => [[conflict.leftCardId, conflict.id], [conflict.rightCardId, conflict.id]]));
  const participants = selected?.participantCount ?? new Set(cards.map(({ author }) => author.accountId)).size;
  const isClosed = selected?.state === "CLOSED";
  const href = `/rooms/${id}/boards/idea`;
  const historyHref = (page: number) => `${href}?${sessionId ? `session=${sessionId}&` : ""}historyPage=${page}`;
  const archivedSessions = new Set(board.history.map(({ id }) => id));
  const sources = new Map(board.cards.map((card) => [card.id, {
    id: card.id,
    title: card.title,
    href: `${href}?${archivedSessions.has(card.sessionId) ? `session=${card.sessionId}&` : ""}briefingFocus=${card.id}`,
  }]));

  return (
    <section className="mx-auto max-w-7xl space-y-4">
      <BriefingFocus ids={readBriefingFocus(query.briefingFocus)} />
      {board.usesMockStream ? <IdeaBoardLive roomId={id} revision={board.revision} />
        : <RoomDataRefresh eventTypes={IDEA_BOARD_EVENTS} />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-xs font-semibold">워크스페이스</p>
          <h1 className="mt-1 text-2xl font-bold">아이디어 보드</h1>
          {selected && (
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-secondary text-primary rounded px-1.5 py-0.5">{isClosed ? "마감" : "진행 중"}</span>
              <strong className="text-foreground">{selected.title}</strong>
              {selected.endsAt && <time dateTime={selected.endsAt}>{ideaDateTime.format(new Date(selected.endsAt))} 마감</time>}
              {isClosed && <span>카드 {selected.cardCount ?? cards.length}개 · 참여 {participants}명</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Suspense fallback={<Button size="sm" variant="outline" disabled>요약 불러오는 중…</Button>}>
            <MeetingSummaryLoader roomId={id} history={board.history} hasActive={Boolean(board.active)} accountId={accountId}
              visibleCards={cards.slice(0, 10).map(({ id: cardId, title }) => ({ id: cardId, title }))} />
          </Suspense>
          <Button variant="outline" size="sm" asChild><Link href={`/rooms/${id}`}><ArrowLeft aria-hidden="true" />대시보드로 돌아가기</Link></Button>
          <details className="group relative">
            <summary className="rounded-control bg-card border-border flex h-8 cursor-pointer list-none items-center gap-1.5 border px-3 text-xs font-medium [&::-webkit-details-marker]:hidden">
              <History aria-hidden="true" className="size-4" />회차 기록
            </summary>
            <div className="bg-card border-border rounded-card absolute right-0 z-10 mt-1 max-h-80 w-60 space-y-1 overflow-auto border p-2 text-sm shadow-md">
              <Link href={href} aria-current={!isClosed ? "page" : undefined} className="hover:bg-muted aria-[current=page]:bg-secondary block rounded px-2 py-1.5">
                {board.active?.title ?? "현재 회차"}{board.active && <span className="text-muted-foreground block text-xs">진행 중</span>}
              </Link>
              {board.history.length ? board.history.map((session) => (
                <Link href={`${href}?session=${session.id}&historyPage=${historyPage}`} key={session.id}
                  aria-current={selected?.id === session.id ? "page" : undefined} className="hover:bg-muted aria-[current=page]:bg-secondary block rounded px-2 py-1.5">
                  {session.title}
                  {session.endsAt && <span className="text-muted-foreground block text-xs">{ideaDateTime.format(new Date(session.endsAt))} 마감</span>}
                </Link>
              )) : <p className="text-muted-foreground px-2 py-1.5 text-xs">{board.editable ? "지난 회차가 없어요." : "지난 회차 기록은 현재 제공되지 않아요."}</p>}
              <div className="flex gap-2 px-2 text-xs">
                {historyPage > 0 && <Link className="underline" href={historyHref(historyPage - 1)}>이전 기록</Link>}
                {board.hasNextHistory && <Link className="underline" href={historyHref(historyPage + 1)}>다음 기록</Link>}
              </div>
            </div>
          </details>
          {board.editable && selected?.state === "ACTIVE" && (
            <>
              <IdeaCardDialog roomId={id} sessionId={selected.id} canUpload={!board.usesMockStream} trigger={<Button size="sm"><Plus aria-hidden="true" />새 카드</Button>} />
              <CloseIdeaDialog roomId={id} sessionId={selected.id} trigger={<Button size="sm" variant="outline" className="text-destructive"><Square aria-hidden="true" />회차 마감</Button>} />
            </>
          )}
          {board.editable && !selected && <StartIdeaDialog roomId={id} trigger={<Button size="sm"><Plus aria-hidden="true" />회차 시작</Button>} />}
        </div>
      </header>
      {selected ? <IdeaBoard key={selected.id} session={selected} cards={cards} accountId={accountId} editable={board.editable} canUpload={!board.usesMockStream} conflictByCard={conflictByCard} sources={sources} openCardId={openCardId} />
        : <p className="bg-card border-border rounded-card text-muted-foreground border p-5 text-sm">진행 중인 회차가 없어요.</p>}
    </section>
  );
}
