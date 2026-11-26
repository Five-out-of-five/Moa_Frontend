import { AlertTriangle, ArrowLeft, CheckCircle2, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { RoomFormDialog } from "@/features/room/management/RoomFormDialog";
import type { ManagementTab } from "@/features/room/management/RoomManagementDetails";
import { RoomManagementDetails } from "@/features/room/management/RoomManagementDetails";
import { getRoomManagement } from "@/features/room/management/server";
import { JOIN_REQUEST_STATUSES } from "@/features/room/management/types";
import { listMyRoomsForSettings } from "@/features/room/server";
import { ApiError } from "@/lib/api";

/**
 * BE 노션 OAuth 콜백이 돌려주는 쿼리를 사용자 안내로 변환.
 * `/workspaces/manage?...&notion=connected|cancelled|error&code=...`
 * - connected · cancelled · error 세 값. error 는 code 로 세부 사유 구분.
 * - 탭이 integrations 가 아니어도 error 는 노출 (승재님 2026-11-25).
 */
function notionBannerFor(status: string | undefined, code: string | undefined) {
  if (status === "connected") {
    return { tone: "success" as const, message: "노션 연결이 완료되었어요." };
  }
  if (status === "cancelled") {
    return { tone: "info" as const, message: "노션 연결이 취소되었어요." };
  }
  if (status === "error") {
    const map: Record<string, string> = {
      INTEGRATION_NOTION_AUTH_EXPIRED: "노션 인증이 만료됐어요. 다시 연결해 주세요.",
      INTEGRATION_NOTION_STATE_INVALID: "요청이 만료됐거나 유효하지 않아요. 연결을 다시 시도해 주세요.",
      ROOM_OWNER_ONLY: "방장만 외부 연동을 설정할 수 있어요.",
    };
    return {
      tone: "error" as const,
      message: code && map[code] ? map[code] : "노션 연결에 실패했어요. 잠시 뒤 다시 시도해 주세요.",
    };
  }
  return null;
}

export default async function WorkspaceManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    room?: string;
    tab?: string;
    create?: string;
    status?: string;
    page?: string;
    notion?: string;
    code?: string;
  }>;
}) {
  const query = await searchParams;
  const rooms = await listMyRoomsForSettings();
  const selected = rooms.find(({ id }) => String(id) === query.room) ?? rooms[0];
  const status = JOIN_REQUEST_STATUSES.find((item) => item === query.status) ?? "PENDING";
  const page = Number(query.page ?? 0);
  const tab: ManagementTab =
    query.tab === "members" ? "members"
      : query.tab === "integrations" ? "integrations"
      : "settings";
  // 멤버·연동 탭에서만 멤버 상세 데이터가 필요. 기본 설정은 가벼운 shape 로 로드.
  const showMembers = tab === "members";
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
    <section className="mx-auto flex max-w-7xl flex-col gap-3">
      <Link
        href={selected && selected.status !== "INACTIVE" ? `/rooms/${selected.id}` : "/workspaces"}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit shrink-0 items-center gap-2 text-sm font-medium hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {selected && selected.status !== "INACTIVE" ? "대시보드로 돌아가기" : "워크스페이스 선택으로 돌아가기"}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">워크스페이스 관리</h1>
        <RoomFormDialog
          key={query.create === "1" ? "create" : "manage"}
          initiallyOpen={query.create === "1"}
        />
      </header>
      {(() => {
        const banner = notionBannerFor(query.notion, query.code);
        if (!banner) return null;
        const Icon = banner.tone === "success" ? CheckCircle2 : banner.tone === "error" ? AlertTriangle : Info;
        return (
          <div
            role="status"
            className={
              banner.tone === "success"
                ? "bg-emerald-50 text-emerald-900 flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm"
                : banner.tone === "error"
                ? "bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                : "bg-muted text-foreground border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            }
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{banner.message}</span>
          </div>
        );
      })()}
      <div className="bg-card rounded-card grid overflow-clip border lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="참여 중인 워크스페이스"
          className="bg-secondary/40 border-border grid min-w-0 content-start gap-1 border-b p-3 sm:grid-cols-2 lg:grid-cols-1 lg:border-r lg:border-b-0"
        >
          <h2 className="text-muted-foreground col-span-full mb-1 text-xs font-medium">
            참여 중인 워크스페이스 · {rooms.length}개
          </h2>
          {rooms.map((room) => (
            <Button
              key={room.id}
              asChild
              variant={room.id === selected?.id ? "secondary" : "ghost"}
              className="h-auto w-full min-w-0 justify-start gap-2 px-2 py-1.5"
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
          <div className="@container min-w-0">
            <RoomManagementDetails
              key={management.room.id}
              management={management}
              tab={tab}
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
