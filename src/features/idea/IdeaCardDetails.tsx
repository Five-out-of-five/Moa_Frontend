"use client";

import { GitCompareArrows, MessageCircle, SmilePlus } from "lucide-react";
import Link from "next/link";

import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ReportMenu } from "@/features/report/ReportMenu";
import type { IdeaCard } from "@/types/db";

import { IdeaCardPanel } from "./IdeaCardPanel";
import { IDEA_COLUMNS, ideaDateTime, type IdeaSourceLink } from "./model";

export function IdeaCardDetails({ card, accountId, canEdit, canReport = false, canUpload, conflictId, sources = [], open, onOpenChange, lockedBy }: {
  card: IdeaCard; accountId: number; canEdit: boolean; canReport?: boolean; canUpload: boolean;
  conflictId?: number; sources?: IdeaSourceLink[]; open: boolean; onOpenChange: (open: boolean) => void; lockedBy?: number;
}) {
  const label = IDEA_COLUMNS.find(({ type }) => type === card.cardType)?.title;
  const locked = lockedBy !== undefined && lockedBy !== accountId;
  return (
    <div className="relative">
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button type="button" className="bg-card border-border rounded-control hover:border-primary/40 focus-visible:ring-ring block w-full space-y-2 border p-3 text-left focus-visible:ring-2">
          <span className="flex h-6 items-center"><span className="bg-secondary text-primary rounded px-1.5 py-0.5 text-xs">{label}</span></span>
          <span className="line-clamp-2 block text-sm font-semibold">{card.title}</span>
          {locked && <span className="text-warning block text-xs">다른 멤버가 편집 중</span>}
          {card.aiSuggested && <span className="text-primary block text-xs">인공지능 제안</span>}
          {card.content && <span className="text-muted-foreground line-clamp-2 block text-xs">{card.content}</span>}
          {(!!card.fileCount || !!card.convertedTaskId || !!card.linkedVote) && (
            <span className="text-muted-foreground block text-xs">
              {!!card.fileCount && `첨부 ${card.fileCount}개 `}
              {!!card.convertedTaskId && "업무 연결 "}
              {card.linkedVote && (card.linkedVote.status === "OPEN" ? "투표 진행 중" : "투표 마감")}
            </span>
          )}
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
          {open && <IdeaCardPanel card={card} accountId={accountId} canUpload={canUpload} canEdit={canEdit} locked={locked}>
          {sources.length > 0 && (
            <section className="border-border space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold">절충안 원본 카드</h3>
              <ul className="space-y-1 text-sm">
                {sources.map((source) => (
                  <li key={source.id}>
                    <SheetClose asChild><Link href={source.href} className="text-primary underline underline-offset-2">{source.title}</Link></SheetClose>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </IdeaCardPanel>}
        </div>
      </SheetContent>
    </Sheet>
    {canReport && <div className="absolute top-3 right-3"><ReportMenu target={{ roomId: card.roomId, id: card.id, type: "CARD", author: card.author.displayName, content: `${card.title}\n${card.content}` }} /></div>}
    {(conflictId || !!card.conflictCount) && (
      <Link
        href={`/rooms/${card.roomId}/mediation${conflictId ? `?conflict=${conflictId}` : ""}`}
        aria-label={`${card.title} 충돌 의견 비교`}
        className={`bg-warning/15 hover:bg-warning/25 border-warning/30 focus-visible:ring-ring absolute top-[13px] ${canReport ? "right-12" : "right-[13px]"} inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium focus-visible:ring-2`}
      >
        <GitCompareArrows aria-hidden="true" className="text-warning size-3.5" />충돌 비교
      </Link>
    )}
    </div>
  );
}
