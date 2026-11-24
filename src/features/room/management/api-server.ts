import "server-only";

import { cache } from "react";

import { getMyAccount } from "@/features/account/server";
import { api } from "@/lib/api";
import { isRoomOwner } from "@/lib/permission";
import type { components } from "@/types/api";

import { type JoinRequestStatus, ROOM_MEMBER_LIMIT } from "./types";

type Schema = components["schemas"];

export function isRoomId(id: number) {
  return Number.isSafeInteger(id) && id > 0;
}

export const getRoomDetail = cache((roomId: number) =>
  api<Schema["RoomDetailResponse"]>(`/api/v1/rooms/${roomId}`, { cache: "no-store" }),
);

type ActiveMember = Pick<
  Schema["MemberProfileResponse"],
  "accountId" | "displayName" | "profileImageUrl" | "positionLabel" | "role" | "online"
>;

export const listActiveRoomMembers = cache((roomId: number) =>
  api<ActiveMember[]>(`/api/v1/rooms/${roomId}/members`, { cache: "no-store" }),
);

export async function getApiRoomManagement(
  roomId: number,
  status: JoinRequestStatus,
  page: number,
  showMembers: boolean,
) {
  if (!isRoomId(roomId)) return null;
  const detail = await getRoomDetail(roomId);
  const role = detail.myMembership?.role;
  if (!role || detail.roomId !== roomId || detail.name == null) return null;
  const isOwner = isRoomOwner({ role });
  const path = `/api/v1/rooms/${roomId}`;
  const [account, members, invite, requests] = await Promise.all([
    getMyAccount(),
    listActiveRoomMembers(roomId),
    isOwner && !showMembers
      ? api<Schema["InviteLinkResponse"]>(`${path}/invite-link`, { cache: "no-store" })
      : null,
    isOwner && showMembers
      ? api<Schema["PageResponseJoinRequestResponse"]>(
          `${path}/join-requests?status=${status}&page=${page}&size=20`,
          { cache: "no-store" },
        )
      : null,
  ]);

  return {
    room: {
      id: roomId,
      name: detail.name,
      description: detail.description ?? null,
      imageUrl: detail.imageUrl ?? null,
      maxMemberCount: detail.maxMemberCount ?? ROOM_MEMBER_LIMIT,
    },
    account,
    isOwner,
    invitePath: invite?.inviteCode ? `/invite/${encodeURIComponent(invite.inviteCode)}` : null,
    inviteUrl: invite?.inviteUrl ?? null,
    members: members.flatMap((member) =>
      member.accountId == null
        ? []
        : [
            {
              accountId: member.accountId,
              name: member.displayName ?? "이름 없는 멤버",
              imageUrl: member.profileImageUrl,
              position: member.positionLabel ?? null,
              isOwner: member.role ? isRoomOwner({ role: member.role }) : false,
            },
          ],
    ),
    requests: (requests?.content ?? []).flatMap((request) =>
      request.requestId == null || request.requester?.accountId == null
        ? []
        : [
            {
              id: String(request.requestId),
              accountId: request.requester.accountId,
              name: request.requester.name ?? "이름 없는 사용자",
              requestedAt: request.requestedAt,
            },
          ],
    ),
    requestStatus: status,
    requestPage: page,
    supportsRequestFilters: true,
    hasNextRequestPage: requests?.hasNext === true,
  };
}
