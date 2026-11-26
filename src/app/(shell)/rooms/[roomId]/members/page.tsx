import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefingFocus } from "@/features/briefing/BriefingFocus";
import { readBriefingFocus } from "@/features/briefing/model";
import { RoomDataRefresh } from "@/features/realtime/RoomDataRefresh";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { RoomMemberList } from "@/features/room/profile/RoomMemberPresence";
import { listRoomMembers } from "@/features/room/server";

export default async function MembersPage({ params, searchParams }: {
  params: Promise<{ roomId: string }>; searchParams: Promise<{ briefingFocus?: string }>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();
  const members = (await listRoomMembers(entry.room.id)).filter(({ memberStatus }) => memberStatus === "ACTIVE");
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <RoomDataRefresh eventTypes={["MEMBER_UPDATED", "MEMBER_JOINED", "MEMBER_LEFT"]} />
      <BriefingFocus ids={readBriefingFocus(query.briefingFocus)} />
      <Link href={`/rooms/${roomId}/briefing`} className="text-primary text-sm underline">브리핑으로 돌아가기</Link>
      <h1 className="text-xl font-bold">방 멤버</h1>
      {members.length ? <RoomMemberList roomId={entry.room.id} members={members} />
        : <p className="text-muted-foreground text-sm">표시할 팀원이 없어요.</p>}
    </section>
  );
}
