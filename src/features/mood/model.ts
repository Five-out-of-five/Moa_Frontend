import type { MoodLevel, MoodStatus } from "@/types/db";

export const MOOD_OPTIONS = [
  { mood: "GREAT", label: "아주 좋아요", emoji: "😄", score: 5, color: "var(--primary)" },
  { mood: "GOOD", label: "좋아요", emoji: "🙂", score: 4, color: "color-mix(in oklch, var(--primary) 78%, var(--background))" },
  { mood: "SOSO", label: "보통이에요", emoji: "😐", score: 3, color: "color-mix(in oklch, var(--primary) 56%, var(--background))" },
  { mood: "TIRED", label: "지쳤어요", emoji: "😮‍💨", score: 2, color: "color-mix(in oklch, var(--primary) 35%, var(--background))" },
  { mood: "BAD", label: "힘들어요", emoji: "😵", score: 1, color: "color-mix(in oklch, var(--primary) 19%, var(--background))" },
] as const satisfies readonly { mood: MoodLevel; label: string; emoji: string; score: number; color: string }[];

export type MoodPeriod = 1 | 7 | 30;

export function summarizeMoods(moods: MoodStatus[]) {
  const counts = MOOD_OPTIONS.map((option) => ({
    ...option,
    count: moods.filter(({ mood }) => mood === option.mood).length,
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
  mood: MoodLevel | null;
  note: string | null;
}
