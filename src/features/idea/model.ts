import type { components } from "@/types/api";
import type { IdeaCardType } from "@/types/db";

export const IDEA_REACTIONS = {
  THUMBS_UP: "👍", CLAP: "👏", FIRE: "🔥", THINKING: "🤔", SAD: "😢",
} as const;

export const IDEA_COLUMNS = [
  { type: "AGENDA", title: "안건", description: "논의가 필요한 주제", color: "bg-primary" },
  { type: "KEEP", title: "유지할 점", description: "계속하면 좋을 점", color: "bg-success" },
  { type: "PROBLEM", title: "문제점", description: "개선이 필요한 부분", color: "bg-warning" },
  { type: "TRY", title: "시도할 점", description: "다음에 실천할 행동", color: "bg-primary/60" },
] as const satisfies readonly { type: IdeaCardType; title: string; description: string; color: string }[];

export const ideaDateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
});

export function parseIdeaDeadline(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const instant = new Date(`${value}:00+09:00`);
  if (Number.isNaN(instant.getTime())) return null;
  const normalized = new Date(instant.getTime() + 9 * 3600_000).toISOString().slice(0, 16);
  return normalized === value ? instant.toISOString() : null;
}

export type IdeaFormResult = { saved?: boolean; error?: string };
export type IdeaMovedCard = { id: number; cardType: IdeaCardType; sortOrder: number; version: number; title?: string; content?: string | null };
export type IdeaMoveResult = IdeaFormResult & { cards?: IdeaMovedCard[] };

export interface IdeaDiscussion {
  comments: { id: number; authorId: number; author: string; text: string; deleted?: boolean; edited?: boolean }[];
  reactions: { emoji: string; count: number; users?: components["schemas"]["MemberRef"][] }[];
}
export type IdeaSourceLink = { id: number; href: string; title: string };
