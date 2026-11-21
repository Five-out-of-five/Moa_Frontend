import "server-only";

import { closeExpiredIdeaSession } from "@/features/idea/mock-board";
import { getIdeaDiscussions } from "@/features/idea/server";
import { listRoomMembers } from "@/features/room/server";
import { accounts, boardEvents, boardSessions, ideaCards, roomMembers, tasks, votes } from "@/mocks/db";
import type { BoardEvent, MemberRef } from "@/types/db";

import { isNewsKind } from "./model";

export type BriefingEvent = Omit<BoardEvent, "id" | "actor"> & { key: string; actor: MemberRef | null };

const runtime = globalThis as typeof globalThis & { moaBriefingEvents?: Map<number, Map<string, BriefingEvent>> };
const eventsByRoom = (runtime.moaBriefingEvents ??= new Map());

export async function readMockBriefingEvents(roomId: number, since: number): Promise<BriefingEvent[]> {
  const members = await listRoomMembers(roomId);
  closeExpiredIdeaSession(roomId);
  const events = eventsByRoom.get(roomId) ?? new Map<string, BriefingEvent>();
  eventsByRoom.set(roomId, events);
  for (const [key, event] of events) {
    if (Date.parse(event.createdAt) < since) events.delete(key);
  }
  function record(key: string, kind: BoardEvent["kind"], actor: MemberRef | null, summary: string, targetType: string, targetId: number, createdAt: string) {
    if (Date.parse(createdAt) < since || events.has(key)) return;
    events.set(key, { key, roomId, kind, actor, summary, targetType, targetId, createdAt });
  }
  for (const event of boardEvents) {
    if (event.roomId === roomId && isNewsKind(event.kind) && event.targetType !== "ROOM") {
      record(`event:${event.id}`, event.kind, event.actor, event.summary, event.targetType, event.targetId, event.createdAt);
    }
  }
  const cards = ideaCards.filter((entry) => entry.roomId === roomId);
  const discussions = getIdeaDiscussions(cards, members);
  for (const card of cards) {
    record(`idea:${card.id}`, "IDEA_CARD_CREATED", card.author, card.title, "IDEA_CARD", card.id, card.createdAt);
    discussions[card.id]?.comments.forEach(({ author, authorId }, index) => {
      const actor = { accountId: authorId, displayName: author, profileImageUrl: null, memberStatus: "ACTIVE" as const };
      // 시드 댓글에는 작성 일시가 없어 원본 카드 일시를 사용한다.
      record(`comment:${card.id}:${index}`, "IDEA_CARD_COMMENTED", actor, card.title, "IDEA_CARD", card.id, card.createdAt);
    });
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
    const actor = session.closedBy === undefined ? null : {
      accountId: session.closedBy, displayName: roster.find(({ accountId }) => accountId === session.closedBy)?.nickname ?? "팀원",
      profileImageUrl: null, memberStatus: "ACTIVE" as const,
    };
    record(`session:${session.id}`, "SESSION_CLOSED", actor, session.title, "SESSION", session.id, session.endsAt);
  }
  for (const vote of votes) {
    if (vote.roomId !== roomId) continue;
    if (vote.createdAt) record(`vote:${vote.voteId}`, "VOTE_OPENED", vote.creator, vote.title, "VOTE", vote.voteId, vote.createdAt);
    if (vote.closedAt) record(`vote-result:${vote.voteId}`, "VOTE_CLOSED", vote.closeReason === "DEADLINE" ? null : vote.creator, vote.title, "VOTE", vote.voteId, vote.closedAt);
  }
  return [...events.values()];
}
