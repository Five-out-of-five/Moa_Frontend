import { getMoodOption, type MoodCounts, type MoodPeriod, type MoodTrendPoint, summarizeMoods, type TeamMoodMember } from "./model";

function wrapText(context: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const character of text) {
    if (line && context.measureText(line + character).width > width) {
      lines.push(line);
      line = character;
    } else line += character;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawMoodImage({
  roomName, date, members, period, trend, distribution, includeNotes, background, foreground,
}: {
  roomName: string;
  date: string;
  members: TeamMoodMember[];
  period: MoodPeriod;
  trend: MoodTrendPoint[];
  distribution: MoodCounts;
  includeNotes: boolean;
  background: string;
  foreground: string;
}) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 만들 수 없습니다.");
  const width = 540;
  const padding = 24;
  context.font = "14px sans-serif";
  const rows = members.map((member) => ({
    member,
    lines: member.note ? wrapText(context, member.note, width - padding * 2 - 38) : [],
  }));
  const trendColumns = 5;
  const trendHeight = period === 1 ? 0 : 34 + Math.ceil(trend.length / trendColumns) * 24;
  const baseHeight = 162 + rows.length * 36 + trendHeight;
  const heightWithNotes = baseHeight + rows.reduce((sum, row) => sum + row.lines.length * 20, 0);
  const height = includeNotes ? heightWithNotes : baseHeight;
  canvas.width = width * 2;
  canvas.height = height * 2;
  context.scale(2, 2);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = foreground;
  context.font = "bold 24px sans-serif";
  context.fillText("팀 상태", padding, 39);
  context.font = "16px sans-serif";
  context.fillText(roomName, padding, 65, width - padding * 2);
  context.font = "13px sans-serif";
  context.fillText(date, padding, 86);
  const { counts, total, average } = summarizeMoods(distribution);
  context.fillText(`오늘 ${total}명 참여 · 평균 ${average?.toFixed(1) ?? "—"}`, padding, 109);
  context.fillText(counts.map(({ emoji, count }) => `${emoji} ${count}`).join("   "), padding, 131);
  let y = 162;
  for (const { member, lines } of rows) {
    const mood = getMoodOption(member.mood);
    context.font = "20px sans-serif";
    context.fillText(mood?.emoji ?? "—", padding, y);
    context.font = "bold 15px sans-serif";
    context.fillText(`${member.name} · ${mood?.label ?? "미입력"}`, padding + 36, y, width - padding * 2 - 36);
    context.font = "14px sans-serif";
    if (includeNotes) {
      for (const line of lines) {
        y += 20;
        context.fillText(line, padding + 36, y);
      }
    }
    y += 36;
  }
  if (period !== 1) {
    context.font = "bold 14px sans-serif";
    context.fillText(`최근 ${period}일 평균 추이`, padding, y);
    context.font = "12px sans-serif";
    const columnWidth = (width - 2 * padding) / trendColumns;
    trend.forEach(({ date, average }, index) => {
      const x = padding + (index % trendColumns) * columnWidth;
      const row = y + 22 + Math.floor(index / trendColumns) * 24;
      context.fillText(`${date.slice(5)}  ${average?.toFixed(1) ?? "—"}`, x, row);
    });
  }
  return { canvas, previewAspectRatio: `${width} / ${height}` };
}

export function exportMoodImage(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지를 만들 수 없습니다.")), "image/png");
  });
}
