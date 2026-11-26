import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { RoomDataRefresh } from "@/features/realtime/RoomDataRefresh";
import { startRoomMemberDmAction } from "@/features/room/profile/member-actions";
import { getRoomMemberProfile } from "@/features/room/profile/member-server";
import { RoomMemberOnline } from "@/features/room/profile/RoomMemberPresence";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ roomId: string; accountId: string }>;
}) {
  const { roomId, accountId } = await params;
  const profile = await getRoomMemberProfile(roomId, accountId);
  if (!profile) notFound();
  if (profile.isSelf) redirect(`/rooms/${roomId}/profile`);

  return (
    <section className="mx-auto max-w-sm space-y-4">
      <RoomDataRefresh eventTypes={["MEMBER_UPDATED", "MEMBER_LEFT"]} />
      <Link className="text-muted-foreground text-sm" href={`/rooms/${roomId}`}>
        워크스페이스로 돌아가기
      </Link>
      <div className="bg-card rounded-card space-y-3 border p-6">
        <h1 className="text-xl font-semibold">멤버 프로필</h1>
        {profile.imageUrl && (
          <Image
            src={profile.imageUrl}
            alt=""
            width={56}
            height={56}
            unoptimized
            className="size-14 rounded-full object-cover"
          />
        )}
        <p className="font-medium break-words">{profile.name}</p>
        {profile.position && <p className="text-muted-foreground text-sm">{profile.position}</p>}
        {profile.accountId !== undefined && <RoomMemberOnline accountId={profile.accountId} online={profile.online} />}
        {profile.canStartDm && (
            <form action={startRoomMemberDmAction.bind(null, roomId, accountId)}>
              <Button type="submit" size="sm">1:1 대화</Button>
            </form>
        )}
      </div>
    </section>
  );
}
