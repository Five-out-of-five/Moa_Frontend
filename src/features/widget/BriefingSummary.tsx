import { Clock3, Newspaper } from "lucide-react";
import Link from "next/link";

import { BriefingRefresh } from "@/features/briefing/BriefingRefresh";
import { getRoomBriefing } from "@/features/briefing/server";

import { BriefingTabs } from "./BriefingTabs";
import { formatWidgetDate, WidgetEmpty } from "./SummaryUi";

export async function BriefingSummary({ roomId }: { roomId: number }) {
  const briefing = await getRoomBriefing(roomId, false);
  if (!briefing) return null;
  const { pending, news: events } = briefing;
  if (!briefing.visible) return <div data-briefing-hidden><BriefingRefresh /></div>;
  return (
    <><BriefingRefresh /><BriefingTabs
      pendingCount={pending.length}
      newsCount={Object.values(briefing.counts).reduce((total, count) => total + count, 0)}
      pending={pending.length ? (
        <ul className="divide-border divide-y">
          {pending.slice(0, 3).map(({ key, title, date, href }, index) => (
            <li key={key} data-preview-extra={index === 2 ? "list-row" : undefined}>
              <Link href={href} className="hover:bg-muted flex items-center gap-2 py-1.5">
                <Clock3 aria-hidden="true" className="text-warning size-4 shrink-0" />
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
            <li key={event.key} data-preview-extra={index === 2 ? "list-row" : undefined} className="flex items-center gap-2 py-1.5">
              <Newspaper aria-hidden="true" className="text-primary size-4 shrink-0" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-xs font-semibold">{event.summary}</p>
                {event.title && <p className="truncate text-xs">{event.title}</p>}
                <time dateTime={event.createdAt} className="text-muted-foreground text-xs">{formatWidgetDate(event.createdAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      ) : <WidgetEmpty>새로운 팀 소식이 없어요.</WidgetEmpty>}
    /></>
  );
}
