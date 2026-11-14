"use client";

import { Hash, Lock, PanelLeftClose, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { RoomProfileLink } from "@/features/room/profile/RoomProfileLink";
import type { RoomProfileSummary } from "@/features/room/profile/types";
import { cn } from "@/lib/utils";

import type { ChatChannel, DirectMessageThread } from "../types";

interface Props {
  channels: readonly ChatChannel[];
  dms: readonly DirectMessageThread[];
  profiles: readonly RoomProfileSummary[];
}

/**
 * 좌측 사이드바 — 현재 방(워크스페이스) 의 채널과 내 1:1 메시지를 세 섹션으로 보여 준다.
 *
 * ⚠️ "현재 방" 은 `/rooms/{id}` URL 로 판단한다. URL 이 그 밖이면 사용자가 속한 전체 채널을
 *    대상으로 검색이 돈다 — 방 밖에서도 사이드바가 비어 보이지 않도록.
 * ⚠️ 검색·사이드바 접기 토글은 전부 **클라이언트 state**. 서버는 채널·DM 목록만 돌려준다.
 * ⚠️ 사이드바 접힌 상태는 후속 이슈로 남기고, 이번엔 토글 버튼 자리만 둔다.
 */
export function ChatSidebar({ channels, dms, profiles }: Props) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const currentRoomId = useMemo(() => {
    const match = pathname.match(/^\/rooms\/(\d+)(?:\/|$)/);
    return match ? Number(match[1]) : null;
  }, [pathname]);

  const profile = profiles.find(({ roomId }) => roomId === currentRoomId);

  const visibleChannels = useMemo(() => {
    const base = currentRoomId
      ? channels.filter((c) => c.roomId === currentRoomId)
      : channels;
    if (!query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, currentRoomId, query]);

  const visibleDms = useMemo(() => {
    if (!query.trim()) return dms;
    const q = query.trim().toLowerCase();
    return dms.filter((d) => d.displayName.toLowerCase().includes(q));
  }, [dms, query]);

  const publicChannels = visibleChannels.filter((c) => c.kind === "PUBLIC");
  const privateChannels = visibleChannels.filter((c) => c.kind === "PRIVATE");

  const activePathMatch = useMemo(() => {
    const match = pathname.match(/\/(channels|dms)\/(\d+)/);
    if (!match) return { kind: null, id: null };
    return { kind: match[1], id: Number(match[2]) };
  }, [pathname]);

  const isSearching = query.trim().length > 0;
  const nothingToShow =
    visibleChannels.length === 0 && visibleDms.length === 0;

  return (
    <nav
      aria-label="채팅 채널"
      className="bg-surface flex h-[calc(100dvh-var(--header-height))] w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border"
    >
      <div className="border-border-soft flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-foreground text-base font-semibold">채팅</h2>
        <div className="flex items-center gap-0.5">
          <IconButton label="새 채널 만들기">
            <Plus className="size-4" />
          </IconButton>
          <IconButton label="사이드바 접기">
            <PanelLeftClose className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="border-border-soft border-b px-3 py-2">
        <label className="relative block">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="채널 검색"
            aria-label="채널·메시지 검색"
            className="border-border bg-background focus:ring-ring h-8 w-full rounded-[var(--radius-control)] border py-1 pr-2 pl-7 text-sm outline-none focus:ring-2"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {nothingToShow ? (
          // ⚠️ 전체 결과가 비었을 때만 통합 안내로 떨어뜨린다. 섹션 중 일부만 비었을 때는
          //    각 섹션이 자체 empty 안내를 띄우도록 아래 분기에서 처리한다 (한쪽만 비었을
          //    때 "검색 결과 없음" 이 떠서 다른 섹션 결과를 가리는 상황을 막는다).
          <EmptyState query={query} />
        ) : (
          <>
            <Section
              label="공개 채널"
              count={publicChannels.length}
              onAdd={{ label: "새 공개 채널" }}
              emptyMessage={
                isSearching
                  ? "검색된 공개 채널이 없어요."
                  : "참여한 공개 채널이 없어요."
              }
            >
              {publicChannels.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  active={
                    activePathMatch.kind === "channels" &&
                    activePathMatch.id === channel.id
                  }
                />
              ))}
            </Section>
            <Section
              label="비공개 채널"
              count={privateChannels.length}
              onAdd={{ label: "새 비공개 채널" }}
              emptyMessage={
                isSearching
                  ? "검색된 비공개 채널이 없어요."
                  : "참여한 비공개 채널이 없어요."
              }
            >
              {privateChannels.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  active={
                    activePathMatch.kind === "channels" &&
                    activePathMatch.id === channel.id
                  }
                />
              ))}
            </Section>
            <Section
              label="1:1 메시지"
              count={visibleDms.length}
              onAdd={{ label: "새 메시지" }}
              emptyMessage={
                isSearching
                  ? "검색된 1:1 메시지가 없어요."
                  : "진행 중인 1:1 메시지가 없어요."
              }
            >
              {visibleDms.map((dm) => (
                <DmRow
                  key={dm.id}
                  dm={dm}
                  active={
                    activePathMatch.kind === "dms" && activePathMatch.id === dm.id
                  }
                />
              ))}
            </Section>
          </>
        )}
      </div>
      {profile && <RoomProfileLink profile={profile} />}
    </nav>
  );
}

/**
 * 사이드바의 한 섹션(공개 채널·비공개 채널·1:1) 틀. 라벨/카운트/추가 버튼을 가진 헤더와
 * 아래쪽 리스트 영역을 그린다.
 *
 * ⚠️ 자식이 비었을 때 `emptyMessage` 가 있으면 섹션 라벨과 함께 안내 문구를 띄운다.
 *    둘 다 없으면 섹션 자체를 숨긴다 — 화면 낭비를 피하고, "참여한 섹션 자체가 없음" 을
 *    상위(ChatSidebar) 의 통합 안내로 처리하게 둔다.
 */
function Section({
  label,
  count,
  onAdd,
  emptyMessage,
  children,
}: {
  label: string;
  count: number;
  onAdd?: { label: string };
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);
  if (!hasChildren && !emptyMessage) return null;

  return (
    <section className="mb-3">
      <div className="flex items-center justify-between px-2 pt-1 pb-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
          <span>{label}</span>
          <span className="text-muted-foreground/70">{count}</span>
        </div>
        {onAdd && (
          <IconButton label={onAdd.label} size="xs">
            <Plus className="size-3" />
          </IconButton>
        )}
      </div>
      {hasChildren ? (
        <ul className="flex flex-col gap-0.5">{children}</ul>
      ) : (
        <p className="text-muted-foreground/80 px-2 py-1 text-xs">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

/** 채널 한 줄 — `#` 또는 자물쇠 아이콘 + 이름 + 미읽음 뱃지. */
function ChannelRow({
  channel,
  active,
}: {
  channel: ChatChannel;
  active: boolean;
}) {
  const Icon = channel.kind === "PRIVATE" ? Lock : Hash;
  return (
    <li>
      <Link
        href={`/rooms/${channel.roomId}/channels/${channel.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-8 items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm transition-colors",
          active
            ? "bg-secondary text-secondary-foreground font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">{channel.name}</span>
        {channel.unreadCount > 0 && <UnreadBadge count={channel.unreadCount} />}
      </Link>
    </li>
  );
}

/** 1:1 스레드 한 줄 — 이니셜 아바타(접속 상태 점) + 상대 이름 + 미읽음 뱃지. */
function DmRow({ dm, active }: { dm: DirectMessageThread; active: boolean }) {
  const initial = dm.displayName.slice(0, 1);
  return (
    <li>
      <Link
        href={`/dms/${dm.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-8 items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm transition-colors",
          active
            ? "bg-secondary text-secondary-foreground font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <span className="relative">
          <span
            aria-hidden="true"
            className="bg-brand text-[10px] font-semibold text-white flex size-5 items-center justify-center rounded-full"
          >
            {initial}
          </span>
          {dm.online && (
            <span
              aria-label="접속 중"
              className="bg-success border-surface absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full border"
            />
          )}
        </span>
        <span className="flex-1 truncate">{dm.displayName}</span>
        {dm.unreadCount > 0 && <UnreadBadge count={dm.unreadCount} />}
      </Link>
    </li>
  );
}

/** 숫자형 미읽음 뱃지 — 99 초과면 "99+" 로 축약. */
function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="bg-brand inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** 사이드바 안 작은 아이콘 전용 버튼 — 섹션 추가(＋), 사이드바 접기 등에서 쓴다. */
function IconButton({
  label,
  size = "sm",
  children,
}: {
  label: string;
  size?: "xs" | "sm";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex items-center justify-center rounded-[var(--radius-control)] transition-colors",
        size === "xs" ? "size-5" : "size-7",
      )}
    >
      {children}
    </button>
  );
}

/** 사이드바 전체가 비었을 때 보여 주는 통합 안내 (검색 중 / 아닐 때 문구 분기). */
function EmptyState({ query }: { query: string }) {
  return (
    <p className="text-muted-foreground px-3 py-10 text-center text-xs">
      {query.trim()
        ? "검색 결과가 없습니다."
        : "참여 중인 채널이 없습니다."}
    </p>
  );
}

/**
 * 사이드바 로딩 fallback — ChatSidebarLoader 실패 또는 Suspense 대기 중에
 * 쉘 레이아웃이 흔들리지 않도록 같은 폭/높이의 스켈레톤을 깐다.
 */
export function ChatSidebarFallback() {
  return (
    <aside
      aria-label="채팅 사이드바 로딩"
      className="bg-surface flex h-[calc(100dvh-var(--header-height))] w-[var(--sidebar-width)] shrink-0 flex-col gap-3 border-r border-border px-4 py-4"
    >
      <span className="bg-muted h-5 w-16 animate-pulse rounded" />
      <span className="bg-muted h-8 w-full animate-pulse rounded" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="bg-muted h-7 w-full animate-pulse rounded" />
        ))}
      </div>
    </aside>
  );
}
