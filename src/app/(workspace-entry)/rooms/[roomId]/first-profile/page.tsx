import { notFound, redirect } from "next/navigation";

import { MoaLogo } from "@/components/common/MoaLogo";
import { FirstProfileForm } from "@/features/room/first-profile/FirstProfileForm";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";

export const dynamic = "force-dynamic";

export default async function FirstProfilePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const entry = await getFirstRoomProfile(roomId);
  if (!entry) notFound();
  if (!entry.setup?.needsSetup) redirect(`/rooms/${entry.room.id}`);

  return (
    <main className="bg-background grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-9">
          <MoaLogo />
        </div>
        <header className="mb-7 text-center">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            워크스페이스 프로필을 완성해 주세요
          </h1>
          <p className="text-muted-foreground mt-2 text-sm break-keep">
            {entry.room.name}에서 사용할 정보를 설정합니다.
          </p>
        </header>
        <FirstProfileForm roomId={roomId} accountName={entry.setup.account.name} />
        <p className="text-muted-foreground mt-5 text-center text-xs">
          이 정보는 해당 워크스페이스 멤버에게 표시됩니다.
        </p>
      </div>
    </main>
  );
}
