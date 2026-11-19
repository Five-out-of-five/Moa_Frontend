import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefingFocus } from "@/features/briefing/BriefingFocus";
import { readBriefingFocus } from "@/features/briefing/model";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";
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
      <BriefingFocus ids={readBriefingFocus(query.briefingFocus)} />
      <Link href={`/rooms/${roomId}/briefing`} className="text-primary text-sm underline">브리핑으로 돌아가기</Link>
      <h1 className="text-xl font-bold">방 멤버</h1>
      {members.length ? <ul className="grid gap-2 sm:grid-cols-2">{members.map(({ accountId, displayName }) => (
        <li key={accountId} data-briefing-id={accountId} className="bg-card border-border rounded-control data-briefing-highlight:ring-primary border p-3 data-briefing-highlight:ring-2">
          <Link className="text-sm font-medium hover:underline" href={`/rooms/${roomId}/members/${accountId}`}>{displayName}</Link>
        </li>
      ))}</ul> : <p className="text-muted-foreground text-sm">표시할 팀원이 없어요.</p>}
    </section>
  );
}
