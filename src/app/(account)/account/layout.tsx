import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AccountSettingsNav } from "@/features/account/components/AccountSettingsNav";
import { getMyAccount } from "@/features/account/server";
import { listMyRooms } from "@/features/room/server";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const [account, rooms] = await Promise.all([getMyAccount(), listMyRooms()]);
  const currentRoom = rooms.find(({ id }) => id === account.lastRoomId) ?? rooms[0];

  return (
    <main className="bg-background min-h-dvh px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href={currentRoom ? `/rooms/${currentRoom.id}` : "/workspaces"}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {currentRoom ? "대시보드로 돌아가기" : "워크스페이스 목록으로 돌아가기"}
        </Link>
        <header className="mt-6 mb-8">
          <p className="text-primary text-sm font-semibold">계정 설정</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            내 계정과 알림을 관리하세요
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            기본 프로필과 모든 워크스페이스에 적용되는 개인 설정입니다.
          </p>
        </header>
        <div className="border-border grid gap-5 rounded-xl border p-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:p-4">
          <AccountSettingsNav />
          {children}
        </div>
      </div>
    </main>
  );
}
