import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getFirstRoomProfile } from "@/features/room/first-profile/server";

export default async function RoomLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();
  if (entry.setup?.needsSetup) redirect(`/rooms/${entry.room.id}/first-profile`);
  return children;
}
