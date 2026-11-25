import { ArrowLeft, BriefcaseBusiness, ClipboardList, Lightbulb, Newspaper, Users, Vote } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { BriefingConfirm } from "@/features/briefing/BriefingConfirm";
import { BriefingRefresh } from "@/features/briefing/BriefingRefresh";
import { BRIEFING_FILTERS, BRIEFING_NEWS, briefingTargetHref, groupBriefingNews } from "@/features/briefing/model";
import { getRoomBriefing } from "@/features/briefing/server";

const ICONS = { idea: Lightbulb, task: BriefcaseBusiness, vote: Vote, team: Users };
const format = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });

export default async function BriefingPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>; searchParams: Promise<{ category?: string }>;
}) {
  const [{ roomId }, { category }] = await Promise.all([params, searchParams]);
  const id = Number(roomId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const briefing = await getRoomBriefing(id);
  if (!briefing) notFound();
  const filter = BRIEFING_FILTERS.find(({ key }) => key === category)?.key ?? "all";
  const base = `/rooms/${id}/briefing`;
  const groups = groupBriefingNews(briefing.news.filter(({ kind }) => filter === "all" || BRIEFING_NEWS[kind].category === filter));
  const teamGroups = groups.filter(({ items }) => !items[0].emphasized);
  const highlightedGroups = groups.filter(({ items }) => items[0].emphasized);
  const newsCount = Object.values(briefing.counts).reduce((total, count) => total + count, 0);

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <BriefingRefresh />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-primary text-xs font-semibold">워크스페이스</p>
          <h1 className="mt-1 text-2xl font-bold">캐치업 브리핑</h1>
          <p className="text-muted-foreground mt-1 text-sm">놓친 팀 활동을 한눈에 확인하세요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href={`/rooms/${id}`}><ArrowLeft aria-hidden="true" />대시보드로 돌아가기</Link></Button>
          {briefing.visible && <span className="text-muted-foreground text-xs">확인할 팀 소식 {newsCount}개</span>}
        </div>
      </header>
      {briefing.visible ? <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="briefing-todo" className="bg-card border-border rounded-card space-y-3 border p-4">
          <header className="flex items-center gap-2"><ClipboardList aria-hidden="true" className="text-primary size-4" />
            <div><h2 id="briefing-todo" className="text-sm font-semibold">내가 할 일</h2><p className="text-muted-foreground text-xs">확인이 필요한 항목 {briefing.pending.length}개</p></div>
          </header>
          {briefing.pending.length ? <ul className="space-y-2">{briefing.pending.map((item) => (
            <li key={item.key} className="border-border rounded-control flex flex-wrap items-center justify-between gap-2 border p-3">
              <div className="min-w-0 space-y-1">
                <p className="text-muted-foreground text-xs">{item.label}{item.date && ` · ${format.format(new Date(item.date))} 마감`}</p>
                <p className="text-sm font-semibold break-words">{item.title}</p>
              </div>
              <Button asChild size="sm" variant="outline"><Link href={item.href}>{item.action}</Link></Button>
            </li>
          ))}</ul> : <p className="text-muted-foreground rounded-control bg-muted p-3 text-sm">지금 해야 할 일이 없어요.</p>}
          {briefing.pending.length > 0 && <p className="text-muted-foreground bg-muted rounded-control p-2.5 text-xs">할 일은 완료하거나 참여하면 목록에서 사라져요.</p>}
        </section>
        <section aria-labelledby="briefing-news" className="bg-card border-border rounded-card space-y-3 border p-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Newspaper aria-hidden="true" className="text-primary size-4" />
              <div><h2 id="briefing-news" className="text-sm font-semibold">팀 소식</h2><p className="text-muted-foreground text-xs">새로운 업데이트 {newsCount}개</p></div>
            </div>
            {(newsCount > 0 || briefing.hasHighlights) && <BriefingConfirm roomId={id} label="모두 확인" />}
          </header>
          <nav aria-label="팀 소식 유형" className="flex flex-wrap gap-1.5">
            {BRIEFING_FILTERS.map(({ key, label }) => <Button key={key} asChild size="sm" variant={key === filter ? "secondary" : "outline"}>
              <Link href={key === "all" ? base : `${base}?category=${key}`} scroll={false} aria-current={filter === key ? "page" : undefined}>{label}</Link>
            </Button>)}
          </nav>
          {!teamGroups.length && <p className="text-muted-foreground rounded-control bg-muted p-3 text-sm">
            {newsCount ? "이 유형의 팀 소식이 없어요." : "새로운 변화 없음"}
          </p>}
          {[{ key: "team", groups: teamGroups }, { key: "personal", groups: highlightedGroups }].map(({ key, groups }) => groups.length > 0 && (
          <div key={key}>
          {key === "personal" && <h3 className="text-primary text-xs font-semibold">내 카드 소식</h3>}
          <ul className="divide-border divide-y">{groups.map((group) => {
            const meta = BRIEFING_NEWS[group.kind];
            const [event] = group.items;
            const Icon = ICONS[meta.category];
            const count = event.eventType ? briefing.counts[event.eventType] : undefined;
            return <li key={group.key} className="flex gap-3 py-3">
              <span className="bg-secondary text-primary rounded-control grid size-8 shrink-0 place-items-center"><Icon aria-hidden="true" className="size-4" /></span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-start justify-between gap-x-2">
                  <p className={event.emphasized ? "text-primary text-sm font-semibold" : "text-sm font-semibold"}>{meta.label}{count !== undefined && ` ${count}개`}</p>
                </div>
                <ul className="divide-border divide-y">{group.items.map((item) => {
                  const href = item.target ? briefingTargetHref(item.target) : undefined;
                  return <li key={item.key} className="space-y-1 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-x-2">
                      <p className="text-muted-foreground text-xs break-words">{item.summary}</p>
                      <time className="text-muted-foreground text-xs" dateTime={item.createdAt}>{format.format(new Date(item.createdAt))}</time>
                    </div>
                    {item.title && <p className="text-xs font-medium break-words">{item.title}</p>}
                    {item.eventType ? <BriefingConfirm roomId={id} eventType={item.eventType} href={href} label={href ? meta.action : "확인"} />
                      : href && <Link className="text-primary text-xs underline" href={href}>{meta.action}</Link>}
                  </li>;
                })}</ul>
              </div>
            </li>;
          })}</ul>
          </div>))}
        </section>
      </div> : <p className="text-muted-foreground text-sm">잠시 후 캐치업 브리핑을 확인할 수 있어요.</p>}
    </section>
  );
}
