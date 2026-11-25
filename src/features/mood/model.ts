import type { MoodLevel } from "@/types/db";

export const MOOD_OPTIONS = [
  { mood: "VERY_GOOD", label: "아주 좋아요", emoji: "😄", score: 5, color: "var(--primary)" },
  { mood: "GOOD", label: "좋아요", emoji: "🙂", score: 4, color: "color-mix(in oklch, var(--primary) 78%, var(--background))" },
  { mood: "NORMAL", label: "보통이에요", emoji: "😐", score: 3, color: "color-mix(in oklch, var(--primary) 56%, var(--background))" },
  { mood: "TIRED", label: "지쳤어요", emoji: "😮‍💨", score: 2, color: "color-mix(in oklch, var(--primary) 35%, var(--background))" },
  { mood: "EXHAUSTED", label: "힘들어요", emoji: "😵", score: 1, color: "color-mix(in oklch, var(--primary) 19%, var(--background))" },
] as const satisfies readonly { mood: MoodLevel; label: string; emoji: string; score: number; color: string }[];

export type MoodPeriod = 1 | 7 | 30;
export type MoodCounts = Partial<Record<MoodLevel, number>>;
export type MoodTrendPoint = { date: string; average: number | null };

export function summarizeMoods(distribution: MoodCounts) {
  const counts = MOOD_OPTIONS.map((option) => ({
    ...option,
    count: distribution[option.mood] ?? 0,
  }));
  const total = counts.reduce((sum, { count }) => sum + count, 0);
  const score = counts.reduce((sum, item) => sum + item.count * item.score, 0);
  return { counts, total, average: total ? score / total : null };
}

export function getMoodOption(mood: MoodLevel | null) {
  return MOOD_OPTIONS.find((option) => option.mood === mood);
}

export interface TeamMoodMember {
  id: number;
  name: string;
  imageUrl: string | null;
  mood: MoodLevel | null;
  note: string | null;
}
