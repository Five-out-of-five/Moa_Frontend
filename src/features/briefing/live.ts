import "server-only";

import { unstable_rethrow } from "next/navigation";

import { getLiveIdeaBriefingTarget } from "@/features/idea/server";
import { api } from "@/lib/api";
import type { components } from "@/types/api";

import { type Briefing, type BriefingEventType, type BriefingNews, type BriefingTarget, type BriefingTodo, isBriefingEventType, type NewsKind, TEAM_NEWS_KINDS } from "./model";

type Schemas = components["schemas"];
const NEWS_SENTENCES: Record<NewsKind, string> = {
  IDEA_CARD_CREATED: "새 아이디어를 추가했어요.", IDEA_CARD_COMMENTED: "내 카드에 댓글을 달았어요.",
  IDEA_CARD_CONVERTED: "내 카드를 업무로 전환했어요.", TASK_CREATED: "새 업무를 등록했어요.",
  TASK_COMPLETED: "업무를 완료했어요.", VOTE_OPENED: "새 투표를 열었어요.", VOTE_CLOSED: "투표를 마감했어요.",
  SESSION_CLOSED: "회차를 마감했어요.", MEMBER_JOINED: "방에 합류했어요.",
};

async function getNewsTarget(
  roomId: number,
  type: Schemas["NewsItem"]["targetType"],
  id?: number,
): Promise<BriefingTarget | null> {
  if (!id) return null;
  const root = `/rooms/${roomId}`;
  switch (type) {
    case "CARD":
      return getLiveIdeaBriefingTarget(roomId, id).catch((error: unknown) => {
        unstable_rethrow(error);
        return null;
      });
    case "TASK":
      return { href: `${root}/boards/task?open=${id}`, focus: id };
    case "VOTE":
      return { href: `${root}/votes?open=${id}`, focus: id };
    case "SESSION":
      return { href: `${root}/boards/idea?session=${id}` };
    case "MEMBER":
      return { href: `${root}/members`, focus: id };
    default:
      return null;
  }
}

export async function getLiveRoomBriefing(roomId: number, withTargets: boolean): Promise<Briefing> {
  const response = await api<Schemas["BriefingResponse"]>(`/api/v1/rooms/${roomId}/briefing`);
  const root = `/rooms/${roomId}`;
  const todos = new Map<string, BriefingTodo>();
  function addTodos(
    items: Schemas["TodoItem"][] | undefined,
    label: string,
    action: string,
    type: "task" | "vote" = "task",
  ) {
    for (const { targetId, title } of items ?? []) {
      if (!targetId || !title) continue;
      const key = `${type}:${targetId}`;
      if (todos.has(key)) continue;
      const path = type === "task" ? "/boards/task" : "/votes";
      todos.set(key, {
        key,
        title,
        date: null,
        label,
        action,
        href: `${root}${path}?open=${targetId}&briefingFocus=${targetId}`,
      });
    }
  }
  if (response.visible === false) return { visible: false, pending: [], news: [], counts: {}, hasHighlights: false };

  // 실서버는 업무 이력을 기준으로 반려·미담당 항목을 분류한다.
  addTodos(response.myTodos?.returnedTasks, "반려된 업무", "수정하기");
  addTodos(response.myTodos?.unassignedTasks, "담당자 미지정", "담당자 지정");
  addTodos(response.myTodos?.assignedTasks, "배정된 업무", "업무 보기");
  addTodos(response.myTodos?.unvotedVotes, "미참여 투표", "투표하기", "vote");

  const counts: Briefing["counts"] = {};
  const news: BriefingNews[] = [];
  const targets = new Map<string, Promise<BriefingTarget | null>>();
  const targetUpdates: Promise<void>[] = [];
  function addNews(items: Schemas["NewsItem"][] | undefined, kind: NewsKind, eventType?: BriefingEventType) {
    for (const item of items ?? []) {
      if (!item.eventId || !item.createdAt || !Number.isFinite(Date.parse(item.createdAt)))
        continue;
      const key = `${item.targetType}:${item.targetId}`;
      if (withTargets && !targets.has(key)) targets.set(key, getNewsTarget(roomId, item.targetType, item.targetId));
      const entry: BriefingNews = { key: `${kind}:${item.eventId}`, kind, eventType, emphasized: !eventType, target: null,
        title: item.title, summary: `${item.actorName ? `${item.actorName}님이 ` : ""}${NEWS_SENTENCES[kind]}`,
        createdAt: item.createdAt };
      news.push(entry);
      const target = targets.get(key);
      if (target) targetUpdates.push(target.then((value) => { entry.target = value; }));
    }
  }
  addNews(response.highlights?.commentsOnMyCards, "IDEA_CARD_COMMENTED");
  addNews(response.highlights?.myCardsConverted, "IDEA_CARD_CONVERTED");
  for (const { eventType, items, count } of response.teamNews ?? []) {
    if (!isBriefingEventType(eventType)) continue;
    counts[eventType] = (counts[eventType] ?? 0) + (count ?? items?.length ?? 0);
    addNews(items, TEAM_NEWS_KINDS[eventType], eventType);
  }
  await Promise.all(targetUpdates);
  return {
    visible: true, counts,
    pending: [...todos.values()],
    news: news.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    hasHighlights: Boolean(response.highlights?.commentsOnMyCards?.length || response.highlights?.myCardsConverted?.length),
  };
}
