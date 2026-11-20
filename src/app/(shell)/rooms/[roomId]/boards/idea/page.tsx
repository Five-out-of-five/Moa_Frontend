import { ArrowLeft, History, Plus, Square } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getMyAccount } from "@/features/account/server";
import { BriefingFocus } from "@/features/briefing/BriefingFocus";
import { readBriefingFocus } from "@/features/briefing/model";
import { IdeaBoard } from "@/features/idea/IdeaBoard";
import { IdeaBoardLive } from "@/features/idea/IdeaBoardLive";
import { CloseIdeaDialog, IdeaCardDialog, StartIdeaDialog } from "@/features/idea/IdeaDialogs";
import { ideaDateTime } from "@/features/idea/model";
import { getIdeaBoard, getIdeaDiscussions } from "@/features/idea/server";
import { listConflicts } from "@/features/mediation/server";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { listRoomMembers } from "@/features/room/server";

export default async function IdeaBoardPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ session?: string; briefingFocus?: string }>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();
  const id = entry.room.id;
  const [board, account] = await Promise.all([getIdeaBoard(id), getMyAccount()]);
  const selected = query.session ? board.history.find((item) => String(item.id) === query.session) : board.active;
  if (query.session && !selected) notFound();
  const cards = selected ? board.cards.filter(({ sessionId }) => sessionId === selected.id) : [];
  const roster = board.editable && cards.some(({ commentCount }) => commentCount > 0)
    ? await listRoomMembers(id) : [];
  const discussion = getIdeaDiscussions(cards, roster);
  const conflicts = await listConflicts(id);
  const conflictByCard = Object.fromEntries(conflicts.filter(({ state }) => state === "OPEN")
    .flatMap((conflict) => [[conflict.leftCardId, conflict.id], [conflict.rightCardId, conflict.id]]));
  const participants = new Set([
    ...cards.map(({ author }) => author.accountId),
    ...Object.values(discussion).flatMap(({ comments }) => comments.map(({ authorId }) => authorId)),
  ]).size;
  const isClosed = selected?.state === "CLOSED";
  const href = `/rooms/${id}/boards/idea`;

  return (
    <section className="mx-auto max-w-7xl space-y-4">
      <BriefingFocus ids={readBriefingFocus(query.briefingFocus)} />
      {board.editable && <IdeaBoardLive roomId={id} revision={board.revision} />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-xs font-semibold">워크스페이스</p>
          <h1 className="mt-1 text-2xl font-bold">아이디어 보드</h1>
          {selected && (
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-secondary text-primary rounded px-1.5 py-0.5">{isClosed ? "마감" : "진행 중"}</span>
              <strong className="text-foreground">{selected.title}</strong>
              {selected.endsAt && <time dateTime={selected.endsAt}>{ideaDateTime.format(new Date(selected.endsAt))} 마감</time>}
              {isClosed && <span>카드 {cards.length}개 · 참여 {participants}명</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild><Link href={`/rooms/${id}`}><ArrowLeft aria-hidden="true" />대시보드로 돌아가기</Link></Button>
          <details className="group relative">
            <summary className="rounded-control bg-card border-border flex h-8 cursor-pointer list-none items-center gap-1.5 border px-3 text-xs font-medium [&::-webkit-details-marker]:hidden">
              <History aria-hidden="true" className="size-4" />회차 기록
            </summary>
            <div className="bg-card border-border rounded-card absolute right-0 z-10 mt-1 w-60 space-y-1 border p-2 text-sm shadow-md">
              <Link href={href} aria-current={!isClosed ? "page" : undefined} className="hover:bg-muted aria-[current=page]:bg-secondary block rounded px-2 py-1.5">
                {board.active?.title ?? "현재 회차"}{board.active && <span className="text-muted-foreground block text-xs">진행 중</span>}
              </Link>
              {board.history.length ? board.history.map((session) => (
                <Link href={`${href}?session=${session.id}`} key={session.id}
                  aria-current={selected?.id === session.id ? "page" : undefined} className="hover:bg-muted aria-[current=page]:bg-secondary block rounded px-2 py-1.5">
                  {session.title}
                  {session.endsAt && <span className="text-muted-foreground block text-xs">{ideaDateTime.format(new Date(session.endsAt))} 마감</span>}
                </Link>
              )) : <p className="text-muted-foreground px-2 py-1.5 text-xs">{board.editable ? "지난 회차가 없어요." : "지난 회차 기록은 현재 제공되지 않아요."}</p>}
            </div>
          </details>
          {board.editable && selected?.state === "ACTIVE" && (
            <>
              <IdeaCardDialog roomId={id} sessionId={selected.id} trigger={<Button size="sm"><Plus aria-hidden="true" />새 카드</Button>} />
              <CloseIdeaDialog roomId={id} sessionId={selected.id} trigger={<Button size="sm" variant="outline" className="text-destructive"><Square aria-hidden="true" />회차 마감</Button>} />
            </>
          )}
          {board.editable && !selected && <StartIdeaDialog roomId={id} trigger={<Button size="sm"><Plus aria-hidden="true" />회차 시작</Button>} />}
        </div>
      </header>
      {selected ? <IdeaBoard session={selected} cards={cards} accountId={account.id} editable={board.editable} discussion={discussion} conflictByCard={conflictByCard} />
        : <p className="bg-card border-border rounded-card text-muted-foreground border p-5 text-sm">진행 중인 회차가 없어요.</p>}
    </section>
  );
}
