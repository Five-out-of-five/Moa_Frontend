import Link from "next/link";
import { notFound } from "next/navigation";

import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { RoomProfileForm } from "@/features/room/profile/RoomProfileForm";

export default async function RoomProfilePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();

  const setup = entry.setup;
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/rooms/${entry.room.id}`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        대시보드로 돌아가기
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">워크스페이스 프로필 설정</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {entry.room.name}에서 사용할 프로필입니다.
        </p>
      </header>
      <div className="bg-card rounded-card border p-5">
        {setup ? (
          <RoomProfileForm
            roomId={roomId}
            accountName={setup.account.name}
            nickname={(setup.profile ? setup.profile.nickname : setup.member.nickname) ?? ""}
            position={setup.profile?.position ?? ""}
            imageUrl={setup.profile?.imageUrl ?? null}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            현재 환경에서는 프로필 설정을 불러올 수 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
