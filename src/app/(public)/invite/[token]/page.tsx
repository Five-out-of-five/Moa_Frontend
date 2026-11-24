import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requestRoomJoinAction } from "@/features/room/management/invite-actions";
import { InviteEntry } from "@/features/room/management/InviteEntry";
import { InviteEntryForm } from "@/features/room/management/InviteEntryForm";
import { RoomCommand } from "@/features/room/management/RoomCommand";
import { getRoomInvite } from "@/features/room/management/server";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]+$/.test(token)) return <InviteEntry invalid />;
  const invitePath = `/invite/${token}`;
  const loginHref = `/login?next=${encodeURIComponent(invitePath)}`;
  const invite = await getRoomInvite(token);
  if (!invite) return <InviteEntry invalid />;
  if (invite.kind === "inactive") return <p role="alert">운영 정책에 따라 비활성화된 방입니다.</p>;
  if (invite.kind === "login") return (
    <>
      <InviteEntryForm invitePath={invitePath} />
      <Button asChild className="w-full"><Link href={loginHref}>로그인하고 참여 요청하기</Link></Button>
    </>
  );
  if (invite.isMember) redirect(`/rooms/${invite.room.id}`);
  const { room, isLoggedIn, isKicked, requestStatus, isFull } = invite;

  return (
    <>
      <InviteEntryForm key={invitePath} invitePath={invitePath} />
      <section
        aria-label="워크스페이스 정보"
        className="bg-card rounded-card border-border space-y-2 border p-5"
      >
        {room.imageUrl ? (
          <Image
            src={room.imageUrl}
            alt=""
            width={56}
            height={56}
            unoptimized
            className="size-14 rounded-md object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-secondary text-secondary-foreground grid size-12 place-items-center rounded-md font-semibold"
          >
            {Array.from(room.name)[0]}
          </span>
        )}
        <h2 className="text-lg font-bold break-words">{room.name}</h2>
        {room.description && (
          <p className="text-muted-foreground text-sm break-words">{room.description}</p>
        )}
        <p className="text-muted-foreground text-sm">
          멤버 {room.memberCount}/{room.maxMemberCount}명 · 방장 승인 후 입장
        </p>
      </section>
      {!isLoggedIn ? (
        <Button asChild className="w-full">
          <Link href={loginHref}>
            로그인하고 참여 요청하기 <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ) : isKicked ? (
        <p role="status" className="text-sm">
          이 워크스페이스에는 다시 참여할 수 없습니다.
        </p>
      ) : requestStatus === "PENDING" ? (
        <p role="status" className="text-sm">
          방장이 참여 요청을 확인하고 있습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {requestStatus === "REJECTED" && (
            <p role="status" className="text-sm">
              이전 참여 요청이 거절됐습니다.
            </p>
          )}
          {requestStatus === "EXPIRED" && (
            <p role="status" className="text-sm">
              이전 참여 요청이 만료됐습니다.
            </p>
          )}
          {isFull ? (
            <p role="status" className="text-sm">
              워크스페이스 정원이 가득 찼습니다.
            </p>
          ) : (
            <RoomCommand
              label="참여 요청 보내기"
              fullWidth
              action={requestRoomJoinAction.bind(null, token)}
            />
          )}
        </div>
      )}
    </>
  );
}
