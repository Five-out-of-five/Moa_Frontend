import { ArrowLeft, Smile } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getMyAccount } from "@/features/account/server";
import { todayMoodDate } from "@/features/mood/date";
import type { MoodPeriod } from "@/features/mood/model";
import { MoodForm } from "@/features/mood/MoodForm";
import { MoodShare } from "@/features/mood/MoodShare";
import { listMoodTrend, listTodayMoods } from "@/features/mood/server";
import { MoodDistribution, MoodTrend, TeamMoodList } from "@/features/mood/TeamMoodPanels";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { listRoomMembers } from "@/features/room/server";

const PERIODS = [{ days: 1, label: "오늘" }, { days: 7, label: "7일" }, { days: 30, label: "30일" }] as const;

export default async function TeamMoodPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();
  const { room } = entry;
  const period: MoodPeriod = query.period === "7" ? 7 : query.period === "30" ? 30 : 1;
  const date = todayMoodDate();
  const [account, roster, recorded, trend] = await Promise.all([
    getMyAccount(), listRoomMembers(room.id), listTodayMoods(room.id),
    period === 1 ? null : listMoodTrend(room.id, period, date),
  ]);
  const activeIds = new Set(roster.filter(({ memberStatus }) => memberStatus === "ACTIVE").map(({ accountId }) => accountId));
  const moods = recorded.filter(({ accountId }) => activeIds.has(accountId));
  const byMember = new Map(moods.map((mood) => [mood.accountId, mood]));
  const me = byMember.get(account.id);
  const members = roster.filter(({ accountId }) => activeIds.has(accountId)).map((member) => {
    const mood = byMember.get(member.accountId);
    return { id: member.accountId, name: member.displayName, mood: mood?.mood ?? null, note: mood?.note ?? null };
  });
  const dashboard = `/rooms/${room.id}`;
  const detail = `${dashboard}/moods`;

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-xs font-semibold">워크스페이스</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">팀 상태</h1>
          <p className="text-muted-foreground mt-1 text-sm">오늘의 기분을 공유하고 팀의 흐름을 살펴보세요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href={dashboard}><ArrowLeft aria-hidden="true" />대시보드로 돌아가기</Link></Button>
          <MoodShare roomName={room.name} date={date} members={members} />
        </div>
      </header>
      <nav aria-label="조회 기간" className="bg-secondary rounded-control inline-flex gap-1 p-1">
        {PERIODS.map(({ days, label }) => (
          <Link key={days} href={days === 1 ? detail : `${detail}?period=${days}`} scroll={false}
            aria-current={period === days ? "page" : undefined}
            className="rounded-control aria-[current=page]:bg-card aria-[current=page]:text-primary text-muted-foreground px-4 py-1.5 text-xs font-semibold">
            {label}
          </Link>
        ))}
      </nav>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
        <section aria-labelledby="my-mood" className="bg-card border-border rounded-card space-y-4 border p-4">
          <h2 id="my-mood" className="flex items-center gap-2 text-sm font-semibold"><Smile aria-hidden="true" className="text-primary size-4" />오늘의 내 기분</h2>
          <MoodForm key={`${room.id}:${date}`} roomId={room.id} mood={me?.mood} note={me?.note} />
        </section>
        <div className="space-y-4">
          <MoodDistribution moods={moods} />
          {period !== 1 && <MoodTrend trend={trend} period={period} />}
          <TeamMoodList members={members} />
        </div>
      </div>
    </section>
  );
}
