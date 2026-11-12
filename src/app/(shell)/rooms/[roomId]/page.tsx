import { notFound } from "next/navigation";

import { listMyRooms } from "@/features/room/server";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const rooms = await listMyRooms();
  const room = rooms.find(({ id }) => String(id) === roomId);

  if (!room) notFound();

  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">{room.name}</h1>
      {room.description && <p className="text-muted-foreground mt-2 text-sm">{room.description}</p>}
    </section>
  );
}
