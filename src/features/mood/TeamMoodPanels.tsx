import { CalendarDays, MessageSquare, Users } from "lucide-react";
import Image from "next/image";

import { getMoodOption, type MoodCounts, type MoodTrendPoint, summarizeMoods, type TeamMoodMember } from "./model";

export function MoodDistribution({ distribution }: { distribution: MoodCounts }) {
  const { counts, total, average } = summarizeMoods(distribution);
  return (
    <section aria-labelledby="mood-distribution" className="bg-card border-border rounded-card space-y-4 border p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 id="mood-distribution" className="flex items-center gap-2 text-sm font-semibold"><Users aria-hidden="true" className="text-primary size-4" />팀 기분 분포</h2>
        <span className="text-muted-foreground text-xs">{total}명 참여</span>
      </header>
      <div className="grid items-center gap-4 sm:grid-cols-[7rem_1fr]">
        <div className="text-center">
          <div className="text-primary text-3xl font-bold tabular-nums">{average?.toFixed(1) ?? "—"}</div>
          <div className="text-muted-foreground text-xs">오늘 평균</div>
        </div>
        <ul className="space-y-2">
          {counts.map(({ mood, emoji, label, color, count }) => (
            <li key={mood} className="grid grid-cols-[5.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-xs">
              <span><span aria-hidden="true">{emoji}</span> {label}</span>
              <span aria-hidden="true" className="bg-muted h-1.5 overflow-hidden rounded-full">
                <span className="block h-full rounded-full" style={{ width: `${total ? count / total * 100 : 0}%`, backgroundColor: color }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </div>
      {!total && <p className="text-muted-foreground text-center text-xs">오늘 등록된 상태가 없어요.</p>}
    </section>
  );
}

export function MoodTrend({ trend, period }: { trend: MoodTrendPoint[]; period: number }) {
  return (
    <section aria-labelledby="mood-trend" className="bg-card border-border rounded-card space-y-4 border p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 id="mood-trend" className="flex items-center gap-2 text-sm font-semibold"><CalendarDays aria-hidden="true" className="text-primary size-4" />일별 기분 추이</h2>
        <span className="text-muted-foreground text-xs">최근 {period}일</span>
      </header>
      {trend.length ? (
        <ul className="grid gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {trend.map(({ date, average }) => (
            <li key={date} className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs">
              <time dateTime={date} className="text-muted-foreground">{Number(date.slice(5, 7))}월 {Number(date.slice(8))}일</time>
              <span aria-hidden="true" className="bg-muted h-1.5 overflow-hidden rounded-full">
                <span className="bg-primary block h-full rounded-full" style={{ width: `${(average ?? 0) * 20}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums" aria-label={average === null ? "평균 없음" : undefined}>{average?.toFixed(1) ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted-foreground text-sm">이 기간에 기록된 기분이 없어요.</p>}
    </section>
  );
}

export function TeamMoodList({ members }: { members: TeamMoodMember[] }) {
  return (
    <section aria-labelledby="mood-team" className="bg-card border-border rounded-card space-y-4 border p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 id="mood-team" className="flex items-center gap-2 text-sm font-semibold"><MessageSquare aria-hidden="true" className="text-primary size-4" />팀원 상태</h2>
        <span className="text-muted-foreground text-xs">오늘 기준</span>
      </header>
      {members.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => {
            const option = getMoodOption(member.mood);
            return (
              <li key={member.id} className={`border-border rounded-control flex items-start gap-2 border p-2.5 ${option ? "bg-card" : "bg-muted/55"}`}>
                {member.imageUrl ? (
                  <Image src={member.imageUrl} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span aria-hidden="true" className="bg-secondary text-primary grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">{Array.from(member.name)[0]}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xs font-semibold">{member.name}</p>
                  <p className="text-muted-foreground mt-1 break-words text-xs">{member.note ?? "남긴 코멘트가 없어요."}</p>
                </div>
                <div className="text-muted-foreground shrink-0 text-right text-xs">
                  <div aria-hidden="true" className="text-base">{option?.emoji ?? "—"}</div>
                  <div>{option?.label ?? "미입력"}</div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-muted-foreground text-sm">표시할 팀원이 없어요.</p>}
    </section>
  );
}
