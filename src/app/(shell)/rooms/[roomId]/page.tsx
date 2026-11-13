import Image from "next/image";
import { notFound } from "next/navigation";

import { getFirstRoomProfile } from "@/features/room/first-profile/server";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const entry = await getFirstRoomProfile(roomId);

  if (!entry) notFound();
  const { room, setup } = entry;
  const profile = setup?.profile;

  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">{room.name}</h1>
      {room.description && <p className="text-muted-foreground mt-2 text-sm">{room.description}</p>}
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
            {profile.nickname ?? setup.member.nickname ?? setup.account.name}
          </p>
        </div>
      )}
    </section>
  );
}
