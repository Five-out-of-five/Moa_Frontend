import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { RoomRealtimeProvider } from "@/features/realtime/RoomRealtimeProvider";
import { getRoomRealtimeConfig } from "@/features/realtime/server";
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
  return (
    <RoomRealtimeProvider key={entry.room.id} roomId={entry.room.id} {...getRoomRealtimeConfig()}>
      <RecordLastRoom roomId={entry.room.id} />
      {children}
    </RoomRealtimeProvider>
  );
}
