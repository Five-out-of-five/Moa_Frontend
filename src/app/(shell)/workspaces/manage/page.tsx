import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { RoomFormDialog } from "@/features/room/management/RoomFormDialog";
import { RoomManagementDetails } from "@/features/room/management/RoomManagementDetails";
import { getRoomManagement } from "@/features/room/management/server";
import { JOIN_REQUEST_STATUSES } from "@/features/room/management/types";
import { listMyRoomsForSettings } from "@/features/room/server";
import { ApiError } from "@/lib/api";

export default async function WorkspaceManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; tab?: string; create?: string; status?: string; page?: string }>;
}) {
  const query = await searchParams;
  const rooms = await listMyRoomsForSettings();
  const selected = rooms.find(({ id }) => String(id) === query.room) ?? rooms[0];
  const status = JOIN_REQUEST_STATUSES.find((item) => item === query.status) ?? "PENDING";
  const page = Number(query.page ?? 0);
  const showMembers = query.tab === "members";
  const management = selected && selected.status !== "INACTIVE"
    ? await getRoomManagement(selected.id, status, Number.isSafeInteger(page) && page >= 0 && page <= 2147483647 ? page : 0, showMembers).catch((error: unknown) => {
        if (error instanceof ApiError) {
          if (error.code === "ROOM_INACTIVE") redirect("/workspaces?roomStatus=inactive");
          if (error.code === "ROOM_NOT_FOUND" || error.code === "ROOM_NOT_MEMBER") redirect("/workspaces");
        }
        throw error;
      })
    : null;

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-4 lg:h-[calc(100dvh-var(--header-height)-var(--spacing)*12)]">
      <Link
        href={selected && selected.status !== "INACTIVE" ? `/rooms/${selected.id}` : "/workspaces"}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit shrink-0 items-center gap-2 text-sm font-medium hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {selected && selected.status !== "INACTIVE" ? "대시보드로 돌아가기" : "워크스페이스 선택으로 돌아가기"}
      </Link>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">워크스페이스 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            방 정보, 초대 링크, 참여 요청을 관리합니다.
          </p>
        </div>
        <RoomFormDialog
          key={query.create === "1" ? "create" : "manage"}
          initiallyOpen={query.create === "1"}
        />
      </header>
      <div className="bg-card rounded-card grid min-h-0 flex-1 overflow-hidden border lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <nav
          aria-label="참여 중인 워크스페이스"
          className="bg-secondary/40 border-border min-h-0 space-y-2 border-b p-4 lg:overflow-y-auto lg:border-r lg:border-b-0"
        >
          <h2 className="text-muted-foreground text-xs font-medium">
            참여 중인 워크스페이스 · {rooms.length}개
          </h2>
          {rooms.map((room) => (
            <Button
              key={room.id}
              asChild
              variant={room.id === selected?.id ? "secondary" : "ghost"}
              className="h-auto w-full justify-start gap-2 px-2 py-2"
            >
              <Link
                href={`/workspaces/manage?room=${room.id}`}
                aria-current={room.id === selected?.id ? "page" : undefined}
              >
                {room.imageUrl ? (
                  <Image
                    src={room.imageUrl}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="size-9 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="bg-secondary text-secondary-foreground grid size-9 shrink-0 place-items-center rounded-md"
                  >
                    {Array.from(room.name)[0]}
                  </span>
                )}
                <span className="min-w-0 text-left">
                  <span className="block truncate">{room.name}</span>
                  {room.isOwner !== null && (
                    <span className="text-muted-foreground block text-xs">
                      {room.isOwner ? "방장" : "멤버"}
                    </span>
                  )}
                </span>
              </Link>
            </Button>
          ))}
        </nav>
        {management ? (
          <div className="min-h-0 min-w-0 lg:overflow-y-auto">
            <RoomManagementDetails
              key={management.room.id}
              management={management}
              showMembers={showMembers}
            />
          </div>
        ) : (
          <p className="text-muted-foreground p-6 text-sm">
            {selected?.status === "INACTIVE" ? "운영 정책에 따라 비활성화된 방입니다." : selected
              ? "현재 환경에서는 방 설정을 불러올 수 없습니다."
              : "참여 중인 워크스페이스가 없습니다."}
          </p>
        )}
      </div>
    </section>
  );
}
