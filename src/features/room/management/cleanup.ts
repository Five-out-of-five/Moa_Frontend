import "server-only";

import {
  accounts,
  boardEvents,
  boardSessions,
  conflicts,
  ideaCards,
  moodStatuses,
  notifications,
  roomMembers,
  rooms,
  roomWidgets,
  sprints,
  tasks,
  votes,
} from "@/mocks/db";
import type { RoomMember } from "@/types/db";

import { roomManagementMock } from "./mock-state";

export function retireMockMember(member: RoomMember, state: "LEFT" | "KICKED") {
  member.state = state;
  member.nickname = null;
  member.notificationMuted = false;
  roomManagementMock.newMemberships.delete(member.id);
  const account = accounts.find(({ id }) => id === member.accountId);
  if (account?.lastRoomId === member.roomId) account.lastRoomId = null;
  for (const task of tasks) {
    if (task.roomId === member.roomId && task.assignee?.accountId === member.accountId) {
      task.assignee = null;
      task.version += 1;
    }
  }
}

function removeMatching<T>(items: T[], matches: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index--) {
    if (matches(items[index])) items.splice(index, 1);
  }
}

export function purgeMockRoom(roomId: number) {
  for (const account of accounts) {
    if (account.lastRoomId === roomId) account.lastRoomId = null;
  }
  for (const member of roomMembers) {
    if (member.roomId === roomId) roomManagementMock.newMemberships.delete(member.id);
  }
  for (const collection of [
    roomMembers,
    roomWidgets,
    moodStatuses,
    boardSessions,
    ideaCards,
    sprints,
    tasks,
    votes,
    boardEvents,
    conflicts,
  ]) {
    removeMatching<{ roomId: number }>(collection, (item) => item.roomId === roomId);
  }
  removeMatching(notifications, (item) => item.room?.roomId === roomId);
  removeMatching(rooms, (item) => item.id === roomId);
  roomManagementMock.inviteTokens.delete(roomId);
  roomManagementMock.creatorIds.delete(roomId);
  for (const [key, request] of roomManagementMock.requests) {
    if (request.roomId === roomId) roomManagementMock.requests.delete(key);
  }
}
