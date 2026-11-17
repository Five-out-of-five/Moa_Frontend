import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";

import { listConflicts } from "@/features/mediation/server";
import { listOpenVotesInRoom } from "@/features/vote/server";

import { formatWidgetDate, SummaryBadge, WidgetEmpty } from "./SummaryUi";

export async function VoteSummary({ roomId }: { roomId: number }) {
  const open = await listOpenVotesInRoom(roomId);
  if (open.length === 0) return <WidgetEmpty>진행 중인 투표가 없어요.</WidgetEmpty>;
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">진행 중 {open.length}개</p>
      <ul className="space-y-2">
        {open.slice(0, 2).map((vote, index) => (
          <li key={vote.voteId} data-preview-extra={index === 1 ? "list-row" : undefined}>
            <Link href={`/rooms/${roomId}/votes`} className="bg-secondary/55 hover:bg-secondary rounded-control block space-y-1.5 p-2.5">
              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-1 text-xs">
                <SummaryBadge>진행 중</SummaryBadge>
                <time dateTime={vote.deadlineAt}>{formatWidgetDate(vote.deadlineAt)} 마감</time>
              </div>
              <p className="line-clamp-2 text-xs font-semibold">{vote.title}</p>
              <div className="text-muted-foreground flex flex-wrap justify-between gap-1 text-xs">
                <span>{vote.memberCount}명 중 {vote.participantCount}명 참여</span>
                <span className={vote.votedByMe ? "text-success" : "text-primary"}>
                  {vote.votedByMe ? "참여 완료" : "미참여"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function MediationSummary({ roomId }: { roomId: number }) {
  const conflicts = (await listConflicts(roomId)).filter(({ state }) => state === "OPEN")
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  const [conflict] = conflicts;
  if (!conflict) return <WidgetEmpty>확인이 필요한 충돌이 없어요.</WidgetEmpty>;
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">확인이 필요한 충돌 {conflicts.length}개</p>
      <div className="bg-secondary/55 rounded-control space-y-2 p-2.5">
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-1 text-xs">
          <SummaryBadge>감지됨</SummaryBadge>
          <time dateTime={conflict.detectedAt}>{formatWidgetDate(conflict.detectedAt)}</time>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs font-semibold">
          <p className="line-clamp-2 wrap-break-word" title={conflict.leftCardTitle}>{conflict.leftCardTitle}</p>
          <ArrowLeftRight aria-hidden="true" className="text-primary size-3.5" />
          <p className="line-clamp-2 wrap-break-word" title={conflict.rightCardTitle}>{conflict.rightCardTitle}</p>
        </div>
        <p className="text-muted-foreground line-clamp-2 text-xs">{conflict.summary}</p>
      </div>
    </div>
  );
}
