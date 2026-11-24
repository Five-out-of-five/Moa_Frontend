import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { RecordLastRoom } from "@/features/room/components/RecordLastRoom";
import { getRoomPageProfile } from "@/features/room/first-profile/server";

export default async function RoomLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const entry = await getRoomPageProfile(roomId);
  if (entry.setup?.needsSetup) redirect(`/rooms/${entry.room.id}/first-profile`);
  return <><RecordLastRoom roomId={entry.room.id} />{children}</>;
}
