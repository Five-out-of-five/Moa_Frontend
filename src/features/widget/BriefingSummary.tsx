import { Clock3, Newspaper, Vote } from "lucide-react";
import Link from "next/link";

import { getMyAccount } from "@/features/account/server";
import { listBoardEvents } from "@/features/briefing/server";
import { listTasksInRoom } from "@/features/task/server";
import { listOpenVotesInRoom } from "@/features/vote/server";

import { BriefingTabs } from "./BriefingTabs";
import { formatWidgetDate, WidgetEmpty } from "./SummaryUi";

export async function BriefingSummary({ roomId }: { roomId: number }) {
  const [events, me, tasks, votes] = await Promise.all([
    listBoardEvents(roomId), getMyAccount(), listTasksInRoom(roomId), listOpenVotesInRoom(roomId),
  ]);
  const pending = [
    ...tasks.filter(({ assignee, status }) => assignee?.accountId === me.id && status !== "DONE")
      .map(({ taskId, title, dueDate }) => ({
        key: `task-${taskId}`, title, date: dueDate, icon: Clock3, href: `/rooms/${roomId}/boards/task`,
      })),
    ...votes.filter(({ votedByMe }) => !votedByMe)
      .map(({ voteId, title, deadlineAt }) => ({
        key: `vote-${voteId}`, title, date: deadlineAt, icon: Vote, href: `/rooms/${roomId}/votes`,
      })),
  ].sort((a, b) => (a.date ?? "\uffff").localeCompare(b.date ?? "\uffff"));
  return (
    <BriefingTabs
      pendingCount={pending.length}
      newsCount={events.length}
      pending={pending.length ? (
        <ul className="divide-border divide-y">
          {pending.slice(0, 3).map(({ key, title, date, icon: Icon, href }, index) => (
            <li key={key} data-preview-extra={index === 2 ? "list-row" : undefined}>
              <Link href={href} className="hover:bg-muted flex items-center gap-2 py-1.5">
                <Icon aria-hidden="true" className="text-warning size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold" title={title}>{title}</p>
                  {date && <time dateTime={date} className="text-muted-foreground text-xs">{formatWidgetDate(date)} 마감</time>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : <WidgetEmpty>지금 해야 할 일이 없어요.</WidgetEmpty>}
      news={events.length ? (
        <ul className="divide-border divide-y">
          {events.slice(0, 3).map((event, index) => (
            <li key={event.id} data-preview-extra={index === 2 ? "list-row" : undefined} className="flex items-center gap-2 py-1.5">
              <Newspaper aria-hidden="true" className="text-primary size-4 shrink-0" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-xs font-semibold">{event.summary}</p>
                <time dateTime={event.createdAt} className="text-muted-foreground text-xs">{formatWidgetDate(event.createdAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      ) : <WidgetEmpty>새로운 팀 소식이 없어요.</WidgetEmpty>}
    />
  );
}
