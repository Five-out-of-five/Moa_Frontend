import type { BoardEventKind } from "@/types/db";

export const BRIEFING_FILTERS = [
  { key: "all", label: "전체" }, { key: "idea", label: "아이디어" }, { key: "task", label: "업무" },
  { key: "vote", label: "투표" }, { key: "team", label: "팀" },
] as const;

export const BRIEFING_NEWS = {
  IDEA_CARD_CREATED: { category: "idea", label: "새 아이디어", action: "아이디어 보기" },
  IDEA_CARD_COMMENTED: { category: "idea", label: "카드 댓글", action: "댓글 보기" },
  IDEA_CARD_CONVERTED: { category: "task", label: "업무 전환", action: "업무 보기" },
  TASK_CREATED: { category: "task", label: "새 업무", action: "업무 보기" },
  TASK_COMPLETED: { category: "task", label: "업무 완료", action: "완료 업무 보기" },
  VOTE_OPENED: { category: "vote", label: "새 투표", action: "투표 보기" },
  VOTE_CLOSED: { category: "vote", label: "투표 결과", action: "결과 보기" },
  SESSION_CLOSED: { category: "idea", label: "회차 마감", action: "회차 기록 보기" },
  MEMBER_JOINED: { category: "team", label: "멤버 합류", action: "멤버 목록 보기" },
} as const satisfies Partial<Record<BoardEventKind, { category: string; label: string; action: string }>>;

export type NewsKind = keyof typeof BRIEFING_NEWS;
export type BriefingFilter = (typeof BRIEFING_FILTERS)[number]["key"];
export const isNewsKind = (kind: BoardEventKind): kind is NewsKind => Object.hasOwn(BRIEFING_NEWS, kind);

export type BriefingTarget = { href: string; focus?: number };
export type BriefingTodo = { key: string; title: string; label: string; date: string | null; action: string; href: string };
export type BriefingNews = {
  key: string; kind: NewsKind; summary: string; createdAt: string; emphasized: boolean; target: BriefingTarget | null;
};
export type BriefingGroup = { key: string; kind: NewsKind; items: BriefingNews[] };

export function groupBriefingNews(items: BriefingNews[]): BriefingGroup[] {
  const groups = new Map<string, BriefingGroup>();
  for (const item of items) {
    const key = item.emphasized ? item.key : `${item.kind}:${item.target?.href ?? item.key}`;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, kind: item.kind, items: [item] });
  }
  return [...groups.values()];
}

export function briefingTargetHref(target: BriefingTarget, focus = target.focus === undefined ? [] : [target.focus]) {
  if (!focus.length) return target.href;
  return `${target.href}${target.href.includes("?") ? "&" : "?"}briefingFocus=${focus.join(",")}`;
}

export function readBriefingFocus(value: string | string[] | undefined) {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").slice(0, 20).map(Number))]
    .filter((id) => Number.isSafeInteger(id) && id > 0);
}
