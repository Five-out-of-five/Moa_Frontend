import { Suspense } from "react";

import { Assistant } from "@/features/ai/Assistant";
import { getRoomPageProfile } from "@/features/room/first-profile/server";
import { RoomDashboard } from "@/features/widget/RoomDashboard";
import { WidgetLoading } from "@/features/widget/WidgetSummary";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room } = await getRoomPageProfile(roomId);

  return (
    <section className="mx-auto w-full max-w-7xl">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">{room.name}</h1>
      {room.description && <p className="text-muted-foreground mt-2 text-sm">{room.description}</p>}
      <Assistant key={room.id} roomId={room.id} />
      <div className="mt-5">
        <Suspense fallback={<WidgetLoading />}>
          <RoomDashboard roomId={room.id} />
        </Suspense>
      </div>
    </section>
  );
}
