import { Lightbulb, MessageCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IdeaBoardLive } from "@/features/idea/IdeaBoardLive";
import { IdeaCardDialog } from "@/features/idea/IdeaDialogs";
import { IdeaLikeButton } from "@/features/idea/IdeaLikeButton";
import { getIdeaBoard, getIdeaDiscussions } from "@/features/idea/server";
import { getReportViewerAccountId } from "@/features/report/server";
import { listRoomMembers } from "@/features/room/server";

import { WidgetEmpty } from "./SummaryUi";

export async function IdeaSummary({ roomId }: { roomId: number }) {
  const { active: session, cards, editable, usesMockStream, revision } = await getIdeaBoard(roomId);
  const live = usesMockStream ? <IdeaBoardLive roomId={roomId} revision={revision} /> : null;
  if (!session) {
    return <>{live}<WidgetEmpty>진행 중인 회차가 없어요.</WidgetEmpty></>;
  }
  const recent = cards.filter(({ sessionId }) => sessionId === session.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const mockReactions = usesMockStream ? getIdeaDiscussions(recent, await listRoomMembers(roomId)) : null;
  const accountId = usesMockStream ? await getReportViewerAccountId() : undefined;
  return (
    <div className="space-y-2">
      {live}
      <div className="bg-secondary/55 rounded-control flex min-w-0 items-center gap-2 p-2.5">
        <Lightbulb aria-hidden="true" className="text-primary size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-primary text-xs">진행 중인 회차</p>
          <p className="truncate text-sm font-semibold" title={session.title}>{session.title}</p>
        </div>
      </div>
      {editable && <IdeaCardDialog roomId={roomId} sessionId={session.id} canUpload={!usesMockStream}
        trigger={<Button size="sm" variant="outline"><Plus aria-hidden="true" />카드 추가</Button>} />}
      {recent.length === 0 ? <WidgetEmpty>이 회차에 등록된 카드가 없어요.</WidgetEmpty> : (
        <ul className="divide-border divide-y">
          {recent.map((card, index) => {
            const reaction = card.reactions?.find(({ emoji }) => emoji === "THUMBS_UP");
            const mockReaction = mockReactions?.[card.id]?.reactions.find(({ emoji }) => emoji === "THUMBS_UP");
            return (
            <li key={card.id} data-preview-extra={index === 2 ? "list-row" : undefined} className="flex items-center gap-2 py-1.5">
              <span aria-hidden="true" className="text-muted-foreground text-xs tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold" title={card.title}>{card.title}</p>
                <p className="text-muted-foreground truncate text-xs">{card.author.displayName}</p>
              </div>
              <IdeaLikeButton roomId={roomId} cardId={card.id}
                count={mockReaction?.count ?? reaction?.count ?? 0}
                selected={mockReactions ? mockReaction?.users?.some((user) => user.accountId === accountId) ?? false : reaction?.reactedByMe ?? false} />
              <span aria-label={`댓글 ${card.commentCount}개`} className="text-muted-foreground flex items-center gap-1 text-xs">
                <MessageCircle aria-hidden="true" className="size-3" />{card.commentCount}
              </span>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
