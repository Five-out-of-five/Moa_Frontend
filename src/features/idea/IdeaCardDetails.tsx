import { GitCompareArrows, MessageCircle, SmilePlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { IdeaCard } from "@/types/db";

import { DeleteIdeaDialog, IdeaCardDialog } from "./IdeaDialogs";
import { IDEA_COLUMNS, ideaDateTime,type IdeaDiscussion } from "./model";

export function IdeaCardDetails({ card, canEdit, discussion, conflictId }: { card: IdeaCard; canEdit: boolean; discussion?: IdeaDiscussion; conflictId?: number }) {
  const label = IDEA_COLUMNS.find(({ type }) => type === card.cardType)?.title;
  return (
    <div className="relative">
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" className="bg-card border-border rounded-control hover:border-primary/40 focus-visible:ring-ring block w-full space-y-2 border p-3 text-left focus-visible:ring-2">
          <span className="flex h-6 items-center"><span className="bg-secondary text-primary rounded px-1.5 py-0.5 text-xs">{label}</span></span>
          <span className="line-clamp-2 block text-sm font-semibold">{card.title}</span>
          {card.aiSuggested && <span className="text-primary block text-xs">인공지능 제안</span>}
          {card.content && <span className="text-muted-foreground line-clamp-2 block text-xs">{card.content}</span>}
          <span className="text-muted-foreground border-border flex items-center gap-2 border-t pt-2 text-xs">
            <span className="min-w-0 flex-1 truncate">{card.author.displayName}</span>
            <span aria-label={`댓글 ${card.commentCount}개`} className="flex items-center gap-1"><MessageCircle aria-hidden="true" className="size-3" />{card.commentCount}</span>
            <span aria-label={`리액션 ${card.reactionCount}개`} className="flex items-center gap-1"><SmilePlus aria-hidden="true" className="size-3" />{card.reactionCount}</span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <p className="text-primary text-xs font-semibold">{label}</p>
          <SheetTitle className="break-words">{card.title}</SheetTitle>
          <SheetDescription>{card.author.displayName} · {ideaDateTime.format(new Date(card.createdAt))}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-5">
          <p className="text-sm break-words whitespace-pre-wrap">{card.content || "등록된 내용이 없어요."}</p>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <IdeaCardDialog roomId={card.roomId} sessionId={card.sessionId} card={card} trigger={<Button variant="outline">카드 수정</Button>} />
              <DeleteIdeaDialog roomId={card.roomId} cardId={card.id} trigger={<Button variant="destructive">카드 삭제</Button>} />
            </div>
          )}
          <section aria-label="리액션" className="border-border space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">리액션 {card.reactionCount}개</h3>
            <div className="flex flex-wrap gap-2">
              {discussion?.reactions.map(({ emoji, count }) => (
                <span key={emoji} className="bg-secondary rounded-full px-2 py-1 text-xs">{emoji} {count}</span>
              ))}
            </div>
            {card.reactionCount > 0 && !discussion && <p className="text-muted-foreground text-xs">리액션별 내역은 현재 제공되지 않아요.</p>}
          </section>
          <section aria-label="댓글" className="border-border space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">댓글 {card.commentCount}개</h3>
            {discussion?.comments.length ? discussion.comments.map(({ author, text }, index) => (
              <div key={index} className="bg-muted rounded-control p-2.5 text-xs">
                <p className="font-semibold">{author}</p><p className="mt-1">{text}</p>
              </div>
            )) : <p className="text-muted-foreground text-xs">{card.commentCount ? "댓글 내역은 현재 제공되지 않아요." : "남겨진 댓글이 없어요."}</p>}
          </section>
        </div>
      </SheetContent>
    </Sheet>
    {conflictId && (
      <Link
        href={`/rooms/${card.roomId}/mediation?conflict=${conflictId}`}
        aria-label={`${card.title} 충돌 의견 비교`}
        className="bg-warning/15 hover:bg-warning/25 border-warning/30 focus-visible:ring-ring absolute top-[13px] right-[13px] inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium focus-visible:ring-2"
      >
        <GitCompareArrows aria-hidden="true" className="text-warning size-3.5" />충돌 비교
      </Link>
    )}
    </div>
  );
}
