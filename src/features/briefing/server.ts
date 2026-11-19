import "server-only";

import { getMyAccount } from "@/features/account/server";
import { roomManagementMock } from "@/features/room/management/mock-state";
import { getManagedRoom } from "@/features/room/management/server";
import { listMyRooms } from "@/features/room/server";
import { listTasksInRoom } from "@/features/task/server";
import { listOpenVotesInRoom } from "@/features/vote/server";
import { api } from "@/lib/api";
import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { boardEvents, boardSessions, ideaCards, roomMembers, tasks, votes } from "@/mocks/db";
import type { BoardEvent } from "@/types/db";

import { type BriefingEvent, readMockBriefingEvents } from "./mock-events";
import { type BriefingNews, type BriefingTarget, briefingTargetHref, type BriefingTodo, isNewsKind, type NewsKind } from "./model";

const NEWS_WINDOW = 30 * 24 * 3600_000;
const runtime = globalThis as typeof globalThis & { moaBriefingRead?: Map<string, Set<string>> };
const readSets = (runtime.moaBriefingRead ??= new Map());

/** 캐치업 브리핑 — 방 변경 이벤트 로그 최근 분. 30일 보관. */
export async function listBoardEvents(roomId: number): Promise<BoardEvent[]> {
  if (isMock) {
    return boardEvents
      .filter((e) => e.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return api<BoardEvent[]>(`/api/v1/rooms/${roomId}/briefing`, { cache: "no-store" });
}

function resolveTarget(roomId: number, event: BriefingEvent, verify: boolean): BriefingTarget | null {
  const root = `/rooms/${roomId}`;
  const focus = event.targetId;
  switch (event.targetType) {
    case "IDEA_CARD": {
      if (!verify) return { href: `${root}/boards/idea`, focus };
      const card = ideaCards.find((item) => item.roomId === roomId && item.id === focus);
      const session = boardSessions.find((item) => item.roomId === roomId && item.id === card?.sessionId);
      return session ? { href: `${root}/boards/idea${session.state === "CLOSED" ? `?session=${session.id}` : ""}`, focus } : null;
    }
    case "TASK":
      return !verify || tasks.some((item) => item.roomId === roomId && item.taskId === focus)
        ? { href: `${root}/boards/task`, focus } : null;
    case "VOTE":
      return !verify || votes.some((item) => item.roomId === roomId && item.voteId === focus)
        ? { href: `${root}/votes`, focus } : null;
    case "SESSION":
      return !verify || boardSessions.some((item) => item.roomId === roomId && item.id === focus && item.state === "CLOSED")
        ? { href: `${root}/boards/idea?session=${focus}` } : null;
    case "MEMBER":
      return !verify || roomMembers.some((item) => item.roomId === roomId && item.accountId === focus && isActiveMember(item))
        ? { href: `${root}/members`, focus } : null;
    default:
      return null;
  }
}

function selectNews(events: BriefingEvent[], roomId: number, accountId: number, checkedSince: number, mark: Set<string>, verify: boolean) {
  const unseen: BriefingNews[] = [];
  for (const event of [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (!isNewsKind(event.kind) || event.roomId !== roomId || event.actor.accountId === accountId ||
      Date.parse(event.createdAt) <= checkedSince || mark.has(event.key)) continue;
    const cardId = event.targetType === "IDEA_CARD" ? event.targetId
      : tasks.find((item) => verify && item.roomId === roomId && item.taskId === event.targetId)?.source.id;
    const emphasized = (event.kind === "IDEA_CARD_COMMENTED" || event.kind === "IDEA_CARD_CONVERTED") &&
      ideaCards.some((card) => verify && card.roomId === roomId && card.id === cardId && card.author.accountId === accountId);
    unseen.push({ key: event.key, kind: event.kind, summary: event.summary, createdAt: event.createdAt, emphasized, target: resolveTarget(roomId, event, verify) });
  }
  return unseen;
}

function limitNews(items: BriefingNews[]) {
  const counts = new Map<NewsKind, number>();
  return items.filter(({ kind }) => {
    const count = counts.get(kind) ?? 0;
    counts.set(kind, count + 1);
    return count < 20;
  });
}

function mockReadState(roomId: number, member: NonNullable<Awaited<ReturnType<typeof getManagedRoom>>>["membership"]) {
  const key = `${roomId}:${member.id}`;
  const read = readSets.get(key) ?? new Set<string>();
  const since = Date.now() - NEWS_WINDOW;
  const events = readMockBriefingEvents(roomId, since);
  const eventKeys = new Set(events.map(({ key }) => key));
  for (const id of read) if (!eventKeys.has(id)) read.delete(id);
  readSets.set(key, read);
  const joined = roomManagementMock.newMemberships.has(member.id) ? Date.parse(member.joinedAt) : 0;
  const sinceChecked = Math.max(since, joined, member.lastBriefingCheckedAt ? Date.parse(member.lastBriefingCheckedAt) : 0);
  return { read, joined, unseen: selectNews(events, roomId, member.accountId, sinceChecked, read, true) };
}

export async function getRoomBriefing(roomId: number) {
  const room = isMock ? await getManagedRoom(roomId) : null;
  if (isMock ? !room : !(await listMyRooms()).some(({ id }) => id === roomId)) return null;
  const account = room?.account ?? await getMyAccount();
  const state = room ? mockReadState(roomId, room.membership) : null;
  const [roomTasks, openVotes, liveEvents] = await Promise.all([
    listTasksInRoom(roomId), listOpenVotesInRoom(roomId), state ? [] : listBoardEvents(roomId),
  ]);
  const pending: BriefingTodo[] = roomTasks.flatMap((task) => {
    if (task.status === "DONE") return [];
    const history = room ? tasks.find((item) => item.roomId === roomId && item.taskId === task.taskId)?.history : undefined;
    const lastAssignment = [...(history ?? [])].reverse().find(({ historyType }) => historyType === "REJECTED" || historyType === "ASSIGNEE_CHANGED" || historyType === "CREATED");
    const returned = task.registrant.accountId === account.id && !task.assignee && lastAssignment?.historyType === "REJECTED";
    const unassigned = task.registrant.accountId === account.id && !task.assignee &&
      (lastAssignment?.historyType === "ASSIGNEE_CHANGED" || lastAssignment?.toAssignee != null);
    if (task.assignee?.accountId !== account.id && !returned && !unassigned) return [];
    return [{ key: `task:${task.taskId}`, title: task.title, date: task.dueDate,
      label: returned ? "반려된 업무" : unassigned ? "담당자 미지정" : "배정된 업무",
      action: returned ? "수정하기" : unassigned ? "담당자 지정" : "업무 보기",
      href: `/rooms/${roomId}/boards/task?open=${task.taskId}&briefingFocus=${task.taskId}` }];
  });
  for (const vote of openVotes) {
    if (Date.parse(vote.deadlineAt) <= Date.now()) continue;
    const mock = state ? votes.find((item) => item.roomId === roomId && item.voteId === vote.voteId) : undefined;
    if (mock && Date.parse(mock.createdAt) <= (state?.joined ?? 0)) continue;
    if (mock ? (mock.participants.some(({ accountId }) => accountId === account.id) || (account.id === 1 && vote.votedByMe)) : vote.votedByMe) continue;
    pending.push({ key: `vote:${vote.voteId}`, title: vote.title, date: vote.deadlineAt, label: "미참여 투표", action: "투표하기",
      href: `/rooms/${roomId}/votes?open=${vote.voteId}&briefingFocus=${vote.voteId}` });
  }
  const news = state?.unseen ?? selectNews(liveEvents.map((event) => ({ ...event, key: `event:${event.id}` })),
    roomId, account.id, Date.now() - NEWS_WINDOW, new Set(), false);
  return { pending: pending.sort((a, b) => (a.date ?? "\uffff").localeCompare(b.date ?? "\uffff")), news: limitNews(news), canConfirm: isMock };
}

export async function confirmMockBriefing(roomId: number, keys?: string[]) {
  if (!isMock) return null;
  const room = await getManagedRoom(roomId);
  if (!room) return null;
  const { unseen, read } = mockReadState(roomId, room.membership);
  const selected = keys ? unseen.filter(({ key }) => keys.includes(key)) : unseen;
  if (keys && !selected.length) return null;
  for (const item of selected) read.add(item.key);
  if (!keys || unseen.every(({ key }) => read.has(key))) {
    room.membership.lastBriefingCheckedAt = new Date().toISOString();
    read.clear();
  }
  const target = selected.find(({ target }) => target)?.target;
  const grouped = target ? selected.flatMap((item) => item.target?.href === target.href && item.target.focus !== undefined ? [item.target.focus] : []) : [];
  return { href: keys && target ? briefingTargetHref(target, grouped) : null };
}
