import "server-only";

import { getLiveIdeaBriefingTarget } from "@/features/idea/server";
import { api } from "@/lib/api";
import { getApiAccountContext } from "@/lib/api-account";
import type { components } from "@/types/api";

import type { BriefingNews, BriefingTarget, BriefingTodo, NewsKind } from "./model";

type Schemas = components["schemas"];
const LIVE_NEWS: Partial<Record<NonNullable<Schemas["TeamNews"]["eventType"]>, NewsKind>> = {
  CARD_CREATED: "IDEA_CARD_CREATED",
  CARD_COMMENTED: "IDEA_CARD_COMMENTED",
  CARD_CONVERTED: "IDEA_CARD_CONVERTED",
  TASK_CREATED: "TASK_CREATED",
  TASK_COMPLETED: "TASK_COMPLETED",
  VOTE_CREATED: "VOTE_OPENED",
  VOTE_CLOSED: "VOTE_CLOSED",
  SESSION_CLOSED: "SESSION_CLOSED",
  MEMBER_JOINED: "MEMBER_JOINED",
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
      return getLiveIdeaBriefingTarget(roomId, id).catch(() => null);
    case "TASK":
      return { href: `${root}/boards/task`, focus: id };
    case "VOTE":
      return { href: `${root}/votes`, focus: id };
    case "SESSION":
      return { href: `${root}/boards/idea?session=${id}` };
    case "MEMBER":
      return { href: `${root}/members`, focus: id };
    default:
      return null;
  }
}

export async function getLiveRoomBriefing(roomId: number) {
  const { init, query } = await getApiAccountContext();
  const response = await api<Schemas["BriefingResponse"]>(
    `/api/v1/rooms/${roomId}/briefing?${query}`,
    init,
  );
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
  if (response.visible === false) return { pending: [], news: [], canConfirm: false };

  // 실서버는 업무 이력을 기준으로 반려·미담당 항목을 분류한다.
  addTodos(response.myTodos?.returnedTasks, "반려된 업무", "수정하기");
  addTodos(response.myTodos?.unassignedTasks, "담당자 미지정", "담당자 지정");
  addTodos(response.myTodos?.assignedTasks, "배정된 업무", "업무 보기");
  addTodos(response.myTodos?.unvotedVotes, "미참여 투표", "투표하기", "vote");

  const entries = new Map<
    number,
    { item: Schemas["NewsItem"]; kind: NewsKind; emphasized: boolean }
  >();
  function addNews(items: Schemas["NewsItem"][] | undefined, kind: NewsKind, emphasized: boolean) {
    for (const item of items ?? []) {
      if (!item.eventId || !item.createdAt || !Number.isFinite(Date.parse(item.createdAt)))
        continue;
      if (!entries.has(item.eventId)) entries.set(item.eventId, { item, kind, emphasized });
    }
  }
  addNews(response.highlights?.commentsOnMyCards, "IDEA_CARD_COMMENTED", true);
  addNews(response.highlights?.myCardsConverted, "IDEA_CARD_CONVERTED", true);
  for (const { eventType, items } of response.teamNews ?? []) {
    const kind = eventType && LIVE_NEWS[eventType];
    if (kind) addNews(items, kind, false);
  }

  const news = await Promise.all(
    [...entries.values()].map(async ({ item, kind, emphasized }): Promise<BriefingNews> => ({
      key: `event:${item.eventId}`,
      kind,
      summary: item.title ?? "",
      createdAt: item.createdAt!,
      emphasized,
      target: await getNewsTarget(roomId, item.targetType, item.targetId),
    })),
  );
  return {
    pending: [...todos.values()],
    news: news.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    canConfirm: false,
  };
}
