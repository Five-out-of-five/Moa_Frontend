import { getMyAccount } from "@/features/account/server";
import { MOOD_OPTIONS, summarizeMoods } from "@/features/mood/model";
import { getTeamMood } from "@/features/mood/server";
import { RoomEventRefresh } from "@/features/realtime/RoomEventRefresh";

import { MoodPicker } from "./MoodPicker";

export async function MoodSummary({ roomId }: { roomId: number }) {
  const [team, me] = await Promise.all([getTeamMood(roomId), getMyAccount()]);
  const { counts, total, average } = summarizeMoods(team.distribution);
  let filled = 0;
  const stops = counts.filter(({ count }) => count > 0).map(({ color, count }) => {
    const start = filled;
    filled += count / total * 100;
    return `${color} ${start}% ${filled}%`;
  });
  return (
    <div className="space-y-1.5">
      {/* 대시보드는 방 연결이 복구될 때 전체 배치와 위젯 데이터를 함께 조회한다. */}
      <RoomEventRefresh eventType="MOOD_UPDATED" refreshOnConnect={false} />
      <p className="text-muted-foreground text-xs">{total ? `오늘 ${total}명 참여` : "오늘 등록된 상태가 없어요."}</p>
      <div className="flex items-center gap-2">
        <div data-preview-extra="mood-chart" className="bg-muted grid size-14 shrink-0 place-items-center rounded-full"
          style={total ? { backgroundImage: `conic-gradient(${stops.join(", ")})` } : undefined}>
          <div className="bg-card grid size-10 content-center rounded-full text-center">
            <span className="text-primary text-base leading-tight font-bold tabular-nums">{average?.toFixed(1) ?? "—"}</span>
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
      <MoodPicker roomId={roomId} selected={team.members.find(({ id }) => id === me.id)?.mood ?? undefined} options={MOOD_OPTIONS} />
    </div>
  );
}
