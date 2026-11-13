import { ArrowRight, Clock3, Link2, Plus, Users } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getWorkspaceSelection } from "@/features/room/server";

export default async function WorkspacesPage() {
  const { workspaces, recentWorkspace } = await getWorkspaceSelection();

  return (
    <section aria-labelledby="workspace-title">
      <header className="mb-7 text-center sm:mb-9">
        <p className="text-primary text-sm font-semibold">워크스페이스 선택</p>
        <h1 id="workspace-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          어디에서 시작할까요?
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed break-keep">
          참여 중인 워크스페이스를 선택하거나 새로운 팀 공간을 만드세요.
        </p>
      </header>

      {recentWorkspace && (
        <div className="rounded-card border-border bg-secondary text-secondary-foreground mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 border px-4 py-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="min-w-0 text-sm break-words">
              마지막으로 사용한 <strong>{recentWorkspace.name}</strong>에 바로 입장할 수 있어요.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="bg-card">
            <Link href={`/rooms/${recentWorkspace.id}`}>바로 입장</Link>
          </Button>
        </div>
      )}

      {workspaces.length === 0 && (
        <p className="text-muted-foreground rounded-card border-border bg-card mb-3 border px-4 py-5 text-center text-sm">
          참여 중인 워크스페이스가 없어요.
        </p>
      )}

      <ul aria-label="워크스페이스" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((room) => (
          <li
            key={room.id}
            className="rounded-card border-border bg-card text-card-foreground flex min-h-56 min-w-0 flex-col gap-4 border p-4 sm:p-5"
          >
            <span
              aria-hidden="true"
              className="rounded-control bg-secondary text-secondary-foreground grid size-10 place-items-center text-sm font-semibold"
            >
              {Array.from(room.name)[0]}
            </span>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 text-sm font-semibold break-words">{room.name}</h2>
                {room.id === recentWorkspace?.id && (
                  <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                    최근 사용
                  </span>
                )}
              </div>
              {room.description && (
                <p className="text-muted-foreground text-xs leading-relaxed break-words">
                  {room.description}
                </p>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Users aria-hidden="true" className="size-4" />
              멤버 {room.memberCount}명
            </p>
            <Button asChild variant="outline" className="bg-card mt-auto w-full">
              <Link href={`/rooms/${room.id}`} aria-label={`${room.name} 워크스페이스 입장`}>
                워크스페이스 입장 <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </li>
        ))}

        <li>
          <Button
            type="button"
            variant="outline"
            disabled
            className="rounded-card border-border bg-card h-full min-h-56 w-full flex-col gap-2 border-dashed p-4 whitespace-normal"
          >
            <span
              aria-hidden="true"
              className="rounded-control bg-secondary text-secondary-foreground grid size-10 place-items-center"
            >
              <Plus />
            </span>
            <span className="font-semibold">새 워크스페이스 만들기</span>
            <span className="text-muted-foreground text-xs">
              새로운 팀을 위한 공간을 시작하세요.
            </span>
          </Button>
        </li>
      </ul>

      <div className="mt-5 flex justify-center">
        <Button type="button" variant="ghost" size="sm" disabled>
          <Link2 aria-hidden="true" /> 초대 링크로 참여하기
        </Button>
      </div>
    </section>
  );
}
