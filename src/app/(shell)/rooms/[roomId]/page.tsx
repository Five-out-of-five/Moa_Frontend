import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Assistant } from "@/features/ai/Assistant";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { RoomDashboard } from "@/features/widget/RoomDashboard";
import { WidgetLoading } from "@/features/widget/WidgetSummary";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const entry = await getFirstRoomProfile(roomId);

  if (!entry) notFound();
  const { room, setup } = entry;
  const profile = setup?.profile;

  return (
    <section className="mx-auto w-full max-w-7xl">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">{room.name}</h1>
      {room.description && <p className="text-muted-foreground mt-2 text-sm">{room.description}</p>}
      <Assistant key={room.id} roomId={room.id} />
      {profile && setup && (
        <div className="border-border mt-5 flex items-center gap-3 border-t pt-4">
          {profile.imageUrl && (
            <Image
              src={profile.imageUrl}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="size-9 rounded-full object-cover"
            />
          )}
          <p className="text-sm">
            <span className="text-muted-foreground mr-2">내 워크스페이스 프로필</span>
            {profile.nickname ?? setup.account.name}
          </p>
        </div>
      )}
      <div className="mt-5">
        <Suspense fallback={<WidgetLoading />}>
          <RoomDashboard roomId={room.id} />
        </Suspense>
      </div>
    </section>
  );
}
