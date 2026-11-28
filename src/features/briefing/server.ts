import "server-only";

import { roomManagementMock } from "@/features/room/management/mock-state";
import { getManagedRoom } from "@/features/room/management/server";
import { listTasksInRoom } from "@/features/task/server";
import { listOpenVotesInRoom } from "@/features/vote/server";
import { isActiveMember } from "@/lib/permission";
import { isMock } from "@/mocks/config";
import { boardSessions, ideaCards, roomMembers, tasks, votes } from "@/mocks/db";

import { getLiveRoomBriefing } from "./live";
import { type BriefingEvent, readMockBriefingEvents } from "./mock-events";
import { type Briefing, type BriefingEventType, type BriefingNews, type BriefingTarget, type BriefingTodo, isNewsKind, type NewsKind, teamNewsType } from "./model";

const NEWS_WINDOW = 30 * 24 * 3600_000;
const runtime = globalThis as typeof globalThis & { moaBriefingRead?: Map<string, Set<string>> };
const readSets = (runtime.moaBriefingRead ??= new Map());

function resolveTarget(roomId: number, event: BriefingEvent): BriefingTarget | null {
  const root = `/rooms/${roomId}`;
  const focus = event.targetId;
  switch (event.targetType) {
    case "IDEA_CARD": {
      const card = ideaCards.find((item) => item.roomId === roomId && item.id === focus);
      const session = boardSessions.find((item) => item.roomId === roomId && item.id === card?.sessionId);
      return session ? { href: `${root}/boards/idea${session.state === "CLOSED" ? `?session=${session.id}` : ""}`, focus } : null;
    }
    case "TASK":
      return tasks.some((item) => item.roomId === roomId && item.taskId === focus)
        ? { href: `${root}/boards/task?open=${focus}`, focus } : null;
    case "VOTE":
      return votes.some((item) => item.roomId === roomId && item.voteId === focus)
        ? { href: `${root}/votes?open=${focus}`, focus } : null;
    case "SESSION":
      return boardSessions.some((item) => item.roomId === roomId && item.id === focus && item.state === "CLOSED")
        ? { href: `${root}/boards/idea?session=${focus}` } : null;
    case "MEMBER":
      return roomMembers.some((item) => item.roomId === roomId && item.accountId === focus && isActiveMember(item))
        ? { href: `${root}/members`, focus } : null;
    default:
      return null;
  }
}

function selectNews(events: BriefingEvent[], roomId: number, accountId: number, checkedSince: number, mark: Set<string>) {
  const unseen: BriefingNews[] = [];
  for (const event of [...events].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))) {
    if (!isNewsKind(event.kind) || event.roomId !== roomId || event.actor?.accountId === accountId ||
      !(Date.parse(event.createdAt) > checkedSince) || mark.has(event.key)) continue;
    const cardId = event.targetType === "IDEA_CARD" ? event.targetId
      : tasks.find((item) => item.roomId === roomId && item.taskId === event.targetId)?.source.id;
    const emphasized = (event.kind === "IDEA_CARD_COMMENTED" || event.kind === "IDEA_CARD_CONVERTED") &&
      ideaCards.some((card) => card.roomId === roomId && card.id === cardId && card.author.accountId === accountId);
    const eventType = teamNewsType(event.kind);
    if (!eventType && !emphasized) continue;
    unseen.push({ key: event.key, kind: event.kind, eventType, summary: event.summary, createdAt: event.createdAt, emphasized, target: resolveTarget(roomId, event) });
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

async function mockReadState(roomId: number, member: NonNullable<Awaited<ReturnType<typeof getManagedRoom>>>["membership"]) {
  const key = `${roomId}:${member.id}`;
  const since = Date.now() - NEWS_WINDOW;
  const events = await readMockBriefingEvents(roomId, since);
  const read = readSets.get(key) ?? new Set<string>();
  const eventKeys = new Set(events.map(({ key }) => key));
  for (const id of read) if (!eventKeys.has(id)) read.delete(id);
  readSets.set(key, read);
  const joined = roomManagementMock.newMemberships.has(member.id) ? Date.parse(member.joinedAt) : 0;
  const sinceChecked = Math.max(since, joined, member.lastBriefingCheckedAt ? Date.parse(member.lastBriefingCheckedAt) : 0);
  return { read, joined, unseen: selectNews(events, roomId, member.accountId, sinceChecked, read) };
}

export async function getRoomBriefing(roomId: number, withTargets = true): Promise<Briefing | null> {
  if (!isMock) return getLiveRoomBriefing(roomId, withTargets);
  const room = await getManagedRoom(roomId);
  if (!room) return null;
  const { account } = room;
  const [state, roomTasks, openVotes] = await Promise.all([
    mockReadState(roomId, room.membership), listTasksInRoom(roomId), listOpenVotesInRoom(roomId),
  ]);
  if (!room.membership.lastBriefingCheckedAt && Date.now() - state.joined < 60_000)
    return { visible: false, pending: [], news: [], counts: {}, hasHighlights: false };
  const pending: BriefingTodo[] = roomTasks.flatMap((task) => {
    if (task.status === "DONE") return [];
    const history = tasks.find((item) => item.roomId === roomId && item.taskId === task.taskId)?.history;
    const lastAssignment = [...(history ?? [])].reverse().find(({ historyType }) => historyType === "REJECTED" || historyType === "ASSIGNEE_CHANGED" || historyType === "CREATED");
    const returned = task.registrant.accountId === account.id && !task.assignee && lastAssignment?.historyType === "REJECTED";
    const unassigned = task.registrant.accountId === account.id && !task.assignee;
    if (task.assignee?.accountId !== account.id && !unassigned) return [];
    return [{ key: `task:${task.taskId}`, title: task.title, date: task.dueDate,
      label: returned ? "반려된 업무" : unassigned ? "담당자 미지정" : "배정된 업무",
      action: returned ? "수정하기" : unassigned ? "담당자 지정" : "업무 보기",
      href: `/rooms/${roomId}/boards/task?open=${task.taskId}&briefingFocus=${task.taskId}` }];
  });
  for (const vote of openVotes) {
    if (Date.parse(vote.deadlineAt) <= Date.now()) continue;
    const mock = votes.find((item) => item.roomId === roomId && item.voteId === vote.voteId);
    if (mock && Date.parse(mock.createdAt) <= state.joined) continue;
    if (mock ? (mock.participants.some(({ accountId }) => accountId === account.id) || (account.id === 1 && vote.votedByMe)) : vote.votedByMe) continue;
    pending.push({ key: `vote:${vote.voteId}`, title: vote.title, date: vote.deadlineAt, label: "미참여 투표", action: "투표하기",
      href: `/rooms/${roomId}/votes?open=${vote.voteId}&briefingFocus=${vote.voteId}` });
  }
  const counts: Briefing["counts"] = {};
  for (const { eventType } of state.unseen) {
    if (eventType) counts[eventType] = (counts[eventType] ?? 0) + 1;
  }
  return { visible: true, pending: pending.sort((a, b) => (a.date ?? "\uffff").localeCompare(b.date ?? "\uffff")),
    news: limitNews(state.unseen), counts, hasHighlights: state.unseen.some(({ emphasized }) => emphasized) };
}

export async function confirmMockBriefing(roomId: number, eventType?: BriefingEventType) {
  if (!isMock) return false;
  const room = await getManagedRoom(roomId);
  if (!room) return false;
  const { unseen, read } = await mockReadState(roomId, room.membership);
  const selected = eventType ? unseen.filter((item) => item.eventType === eventType) : unseen;
  if (eventType && !selected.length) return true;
  for (const item of selected) read.add(item.key);
  if (!eventType || unseen.every((item) => read.has(item.key))) {
    room.membership.lastBriefingCheckedAt = new Date().toISOString();
    read.clear();
  }
  return true;
}
