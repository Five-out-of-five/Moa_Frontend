import "server-only";

import { accounts, boardEvents, boardSessions, ideaCards, roomMembers, tasks, votes } from "@/mocks/db";
import type { BoardEvent, MemberRef } from "@/types/db";

import { isNewsKind } from "./model";

export type BriefingEvent = Omit<BoardEvent, "id"> & { key: string };

const runtime = globalThis as typeof globalThis & { moaBriefingEvents?: Map<number, Map<string, BriefingEvent>> };
const eventsByRoom = (runtime.moaBriefingEvents ??= new Map());

export function readMockBriefingEvents(roomId: number, since: number): BriefingEvent[] {
  const events = eventsByRoom.get(roomId) ?? new Map<string, BriefingEvent>();
  eventsByRoom.set(roomId, events);
  for (const [key, event] of events) {
    if (Date.parse(event.createdAt) < since) events.delete(key);
  }
  function record(key: string, kind: BoardEvent["kind"], actor: MemberRef, summary: string, targetType: string, targetId: number, createdAt: string) {
    if (Date.parse(createdAt) < since || events.has(key)) return;
    events.set(key, { key, roomId, kind, actor, summary, targetType, targetId, createdAt });
  }
  for (const event of boardEvents) {
    if (event.roomId === roomId && isNewsKind(event.kind) && event.targetType !== "ROOM") {
      record(`event:${event.id}`, event.kind, event.actor, event.summary, event.targetType, event.targetId, event.createdAt);
    }
  }
  for (const card of ideaCards.filter((entry) => entry.roomId === roomId)) {
    record(`idea:${card.id}`, "IDEA_CARD_CREATED", card.author, card.title, "IDEA_CARD", card.id, card.createdAt);
    if (card.convertedTaskId !== null) {
      const task = tasks.find((entry) => entry.roomId === roomId && entry.taskId === card.convertedTaskId);
      if (task) record(`converted:${task.taskId}`, "IDEA_CARD_CONVERTED", task.registrant, task.title, "TASK", task.taskId, task.createdAt);
    }
  }
  for (const task of tasks.filter((entry) => entry.roomId === roomId)) {
    record(`task:${task.taskId}`, "TASK_CREATED", task.registrant, task.title, "TASK", task.taskId, task.createdAt);
    for (const history of task.history) {
      if (history.historyType === "STATUS_CHANGED" && history.toStatus === "DONE") {
        record(`done:${task.taskId}:${history.createdAt}`, "TASK_COMPLETED", history.actor, task.title, "TASK", task.taskId, history.createdAt);
      }
    }
  }
  const roster = roomMembers.filter((entry) => entry.roomId === roomId);
  for (const member of roster) {
    const actor = {
      accountId: member.accountId, displayName: member.nickname ?? accounts.find(({ id }) => id === member.accountId)?.name ?? "팀원",
      profileImageUrl: null, memberStatus: "ACTIVE" as const,
    };
    if (member.role !== "OWNER") record(`joined:${member.id}`, "MEMBER_JOINED", actor, `${actor.displayName}님이 팀에 합류했어요.`, "MEMBER", actor.accountId, member.joinedAt);
  }
  for (const session of boardSessions) {
    if (session.roomId !== roomId || session.state !== "CLOSED" || !session.endsAt) continue;
    const owner = roster.find(({ accountId }) => accountId === session.closedBy)
      ?? roster.find(({ role }) => role === "OWNER");
    if (!owner) continue;
    const actor = { accountId: owner.accountId, displayName: owner.nickname ?? "방장", profileImageUrl: null, memberStatus: "ACTIVE" as const };
    record(`session:${session.id}`, "SESSION_CLOSED", actor, session.title, "SESSION", session.id, session.endsAt);
  }
  for (const vote of votes) {
    if (vote.roomId !== roomId) continue;
    if (vote.createdAt) record(`vote:${vote.voteId}`, "VOTE_OPENED", vote.creator, vote.title, "VOTE", vote.voteId, vote.createdAt);
    if (vote.closedAt) record(`vote-result:${vote.voteId}`, "VOTE_CLOSED", vote.creator, vote.title, "VOTE", vote.voteId, vote.closedAt);
  }
  return [...events.values()];
}
