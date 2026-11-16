import { getMyAccount } from "@/features/account/server";
import { listTodayMoods } from "@/features/mood/server";

import { MoodPicker } from "./MoodPicker";

const MOOD_OPTIONS = [
  { mood: "GREAT", label: "아주 좋아요", score: 5, color: "var(--primary)" },
  { mood: "GOOD", label: "좋아요", score: 4, color: "color-mix(in oklch, var(--primary) 78%, var(--background))" },
  { mood: "SOSO", label: "보통이에요", score: 3, color: "color-mix(in oklch, var(--primary) 56%, var(--background))" },
  { mood: "TIRED", label: "지쳤어요", score: 2, color: "color-mix(in oklch, var(--primary) 35%, var(--background))" },
  { mood: "BAD", label: "힘들어요", score: 1, color: "color-mix(in oklch, var(--primary) 19%, var(--background))" },
] as const;

export async function MoodSummary({ roomId }: { roomId: number }) {
  const [moods, me] = await Promise.all([listTodayMoods(roomId), getMyAccount()]);
  const counts = MOOD_OPTIONS.map((option) => ({
    ...option,
    count: moods.filter(({ mood }) => mood === option.mood).length,
  }));
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const average = total ? counts.reduce((sum, item) => sum + item.count * item.score, 0) / total : 0;
  let filled = 0;
  const stops = counts.filter(({ count }) => count > 0).map(({ color, count }) => {
    const start = filled;
    filled += count / total * 100;
    return `${color} ${start}% ${filled}%`;
  });
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs">{total ? `오늘 ${total}명 참여` : "오늘 등록된 상태가 없어요."}</p>
      <div className="flex items-center gap-2">
        <div data-preview-extra="mood-chart" className="bg-muted grid size-14 shrink-0 place-items-center rounded-full"
          style={total ? { backgroundImage: `conic-gradient(${stops.join(", ")})` } : undefined}>
          <div className="bg-card grid size-10 content-center rounded-full text-center">
            <span className="text-primary text-base leading-tight font-bold tabular-nums">{total ? average.toFixed(1) : "—"}</span>
            <span className="text-muted-foreground text-xs">평균</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1">
          {counts.map(({ mood, label, color, count }) => (
            <li key={mood} className="flex items-center gap-1.5 text-xs">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground min-w-0 flex-1 truncate" title={label}>{label}</span>
              <span className="font-semibold tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </div>
      <MoodPicker roomId={roomId} selected={moods.find(({ accountId }) => accountId === me.id)?.mood} options={MOOD_OPTIONS} />
    </div>
  );
}
