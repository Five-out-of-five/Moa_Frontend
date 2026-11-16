import { Lightbulb, MessageCircle, ThumbsUp } from "lucide-react";

import { getActiveSession, listIdeaCards } from "@/features/idea/server";

import { WidgetEmpty } from "./SummaryUi";

export async function IdeaSummary({ roomId }: { roomId: number }) {
  const [session, cards] = await Promise.all([getActiveSession(roomId), listIdeaCards(roomId)]);
  if (!session) return <WidgetEmpty>진행 중인 회차가 없어요.</WidgetEmpty>;
  const recent = cards.filter(({ sessionId }) => sessionId === session.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  return (
    <div className="space-y-2">
      <div className="bg-secondary/55 rounded-control flex min-w-0 items-center gap-2 p-2.5">
        <Lightbulb aria-hidden="true" className="text-primary size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-primary text-xs">진행 중인 회차</p>
          <p className="truncate text-sm font-semibold" title={session.title}>{session.title}</p>
        </div>
      </div>
      {recent.length === 0 ? <WidgetEmpty>이 회차에 등록된 카드가 없어요.</WidgetEmpty> : (
        <ul className="divide-border divide-y">
          {recent.map((card, index) => (
            <li key={card.id} data-preview-extra={index === 2 ? "list-row" : undefined} className="flex items-center gap-2 py-1.5">
              <span aria-hidden="true" className="text-muted-foreground text-xs tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold" title={card.title}>{card.title}</p>
                <p className="text-muted-foreground truncate text-xs">{card.author.displayName}</p>
              </div>
              <span aria-label={`반응 ${card.reactionCount}개`} className="text-muted-foreground flex items-center gap-1 text-xs">
                <ThumbsUp aria-hidden="true" className="size-3" />{card.reactionCount}
              </span>
              <span aria-label={`댓글 ${card.commentCount}개`} className="text-muted-foreground flex items-center gap-1 text-xs">
                <MessageCircle aria-hidden="true" className="size-3" />{card.commentCount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
