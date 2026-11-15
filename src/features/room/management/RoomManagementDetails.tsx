import Link from "next/link";

import { Button } from "@/components/ui/button";

import { deleteManagedRoomAction, updateManagedMemberAction } from "./actions";
import { decideRoomJoinAction } from "./invite-actions";
import { InviteCopyButton } from "./InviteCopyButton";
import { RoomCommand } from "./RoomCommand";
import { RoomFormDialog } from "./RoomFormDialog";
import type { getRoomManagement } from "./server";

type Management = NonNullable<Awaited<ReturnType<typeof getRoomManagement>>>;

export function RoomManagementDetails({
  management,
  showMembers,
}: {
  management: Management;
  showMembers: boolean;
}) {
  const { room, isOwner } = management;
  const path = `/workspaces/manage?room=${room.id}`;
  return (
    <div className="min-w-0">
      <header className="border-border space-y-3 border-b px-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{room.name}</h2>
            {room.description && (
              <p className="text-muted-foreground text-sm break-words">{room.description}</p>
            )}
          </div>
          <span className="bg-secondary rounded-full px-2 py-1 text-xs">
            {isOwner ? "방장" : "멤버"}
          </span>
        </div>
        <nav aria-label="관리 메뉴" className="flex gap-4 text-sm">
          <Link
            className={
              showMembers
                ? "text-muted-foreground pb-2"
                : "border-primary border-b-2 pb-2 font-medium"
            }
            href={path}
            aria-current={!showMembers ? "page" : undefined}
          >
            기본 설정
          </Link>
          <Link
            className={
              showMembers
                ? "border-primary border-b-2 pb-2 font-medium"
                : "text-muted-foreground pb-2"
            }
            href={`${path}&tab=members`}
            aria-current={showMembers ? "page" : undefined}
          >
            멤버 · {management.members.length}
          </Link>
        </nav>
      </header>
      {showMembers ? (
        <MembersPanel management={management} />
      ) : (
        <SettingsPanel management={management} />
      )}
    </div>
  );
}

function SettingsPanel({ management }: { management: Management }) {
  const { room, isOwner, inviteToken } = management;
  const invitePath = inviteToken ? `/invite/${inviteToken}` : null;
  return (
    <div className="space-y-4 p-5">
      <section className="rounded-card border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">워크스페이스 정보</h3>
          {isOwner && <RoomFormDialog room={room} />}
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">이름</dt>
            <dd>{room.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">설명</dt>
            <dd className="break-words">{room.description ?? "등록된 설명이 없습니다."}</dd>
          </div>
        </dl>
      </section>
      {invitePath && (
        <section className="rounded-card border p-4">
          <h3 className="font-semibold">영구 초대 링크</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            링크를 받은 사용자는 방장 승인 후 참여할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Link href={invitePath} className="text-primary text-sm break-all hover:underline">
              {invitePath}
            </Link>
            <InviteCopyButton path={invitePath} />
          </div>
        </section>
      )}
      <section className="rounded-card flex flex-wrap items-center justify-between gap-3 border p-4">
        <h3 className="font-semibold">내 워크스페이스 프로필</h3>
        <Button asChild variant="outline" size="sm">
          <Link href={`/rooms/${room.id}/profile`}>프로필 수정</Link>
        </Button>
      </section>
      <section className="rounded-card border-destructive/30 flex flex-wrap items-center justify-between gap-3 border p-4">
        <h3 className="font-semibold">워크스페이스 나가기 및 삭제</h3>
        {isOwner ? (
          <RoomCommand
            label="워크스페이스 삭제"
            destructive
            roomName={room.name}
            confirmText={`삭제하려면 ‘${room.name}’을 입력해 주세요. 삭제한 방은 복구할 수 없습니다.`}
            action={deleteManagedRoomAction.bind(null, room.id)}
          />
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/account">계정 설정에서 나가기</Link>
          </Button>
        )}
      </section>
    </div>
  );
}

function MembersPanel({ management }: { management: Management }) {
  const { room, isOwner, requests, members, account } = management;
  return (
    <div className="space-y-4 p-5">
      {isOwner && (
        <section className="rounded-card border p-4">
          <h3 className="font-semibold">가입 요청 · {requests.length}건</h3>
          {requests.length ? (
            <ul className="divide-border mt-2 divide-y">
              {requests.map((request) => (
                <li
                  key={request.accountId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <span>{request.name}</span>
                  <div className="flex gap-2">
                    <RoomCommand
                      label="거절"
                      confirmText={`${request.name}님의 참여 요청을 거절할까요?`}
                      action={decideRoomJoinAction.bind(null, room.id, request.accountId, false)}
                    />
                    <RoomCommand
                      label="승인"
                      action={decideRoomJoinAction.bind(null, room.id, request.accountId, true)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">대기 중인 참여 요청이 없습니다.</p>
          )}
        </section>
      )}
      <section className="rounded-card border p-4">
        <h3 className="font-semibold">
          활성 멤버 · {members.length}/{room.maxMemberCount}명
        </h3>
        <ul className="divide-border mt-2 divide-y">
          {members.map((member) => (
            <li
              key={member.accountId}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{member.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {member.isOwner ? "방장" : "멤버"}
                  {member.position && ` · ${member.position}`}
                </span>
              </div>
              {member.accountId === account.id ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/rooms/${room.id}/profile`}>내 정보 수정</Link>
                </Button>
              ) : (
                isOwner && (
                  <div className="flex gap-2">
                    <RoomCommand
                      label="방장 위임"
                      confirmText={`${member.name}님에게 방장 권한을 위임할까요?`}
                      action={updateManagedMemberAction.bind(
                        null,
                        room.id,
                        member.accountId,
                        "transfer",
                      )}
                    />
                    <RoomCommand
                      label="내보내기"
                      confirmText={`${member.name}님을 내보낼까요? 내보낸 멤버는 다시 참여할 수 없습니다.`}
                      destructive
                      action={updateManagedMemberAction.bind(
                        null,
                        room.id,
                        member.accountId,
                        "remove",
                      )}
                    />
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
