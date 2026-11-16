"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ChatMessage, DirectMessageThread } from "../types";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

interface Props {
  thread: DirectMessageThread;
  initialMessages: readonly ChatMessage[];
  me: { accountId: number; displayName: string } | null;
}

/**
 * DM 메시지 페이지 — 채널과 같은 레이아웃이지만 헤더가 **상대방 아바타·접속 상태** 중심.
 *
 * ⚠️ DM 라우트는 방 밖(`/dms/[dmId]`) 이라 대시보드 복귀 링크 대상이 불분명. `ChatSidebar` 가
 *    쓰던 `/rooms/...` 패턴과 달라 여기선 "내 방 목록" 으로 돌아가는 링크로 뗀다.
 */
export function DmPageClient({ thread, initialMessages, me }: Props) {
  const [messages, setMessages] = useState<readonly ChatMessage[]>(initialMessages);

  const handleSend = (content: string) => {
    if (!me) return;
    const tempId = -Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        author: { accountId: me.accountId, displayName: me.displayName },
        createdAt: new Date().toISOString(),
        content,
        pending: true,
      },
    ]);
  };

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100dvh-var(--header-height))] flex-col">
      <header className="border-border-soft bg-surface flex items-center justify-between gap-3 border-b px-6 py-3">
        <div className="min-w-0 flex items-center gap-2.5">
          <DmAvatar name={thread.displayName} online={thread.online} />
          <div className="min-w-0">
            <h1 className="text-foreground truncate text-base font-semibold">
              {thread.displayName}
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              {thread.online ? "접속 중" : "오프라인"}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/rooms" className="inline-flex items-center gap-1">
            <ArrowLeft className="size-4" />내 방 목록
          </Link>
        </Button>
      </header>

      <MessageList
        messages={messages}
        emptyState={<EmptyDmHero name={thread.displayName} />}
        formatTime={formatTime}
        formatDateDivider={formatDateDivider}
      />

      <div className="border-border-soft bg-background border-t px-6 py-3">
        <MessageComposer
          placeholder={`${thread.displayName} 님에게 메시지 보내기`}
          disabledReason={me ? undefined : "로그인 후 메시지를 보낼 수 있어요."}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}

function DmAvatar({ name, online }: { name: string; online: boolean }) {
  const initial = name.slice(0, 1);
  return (
    <span className="relative inline-flex">
      <span
        aria-hidden="true"
        className="bg-brand text-sm font-semibold text-white flex size-9 items-center justify-center rounded-[var(--radius-control)]"
      >
        {initial}
      </span>
      <span
        aria-label={online ? "접속 중" : "오프라인"}
        className={cn(
          "border-surface absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2",
          online ? "bg-success" : "bg-muted",
        )}
      />
    </span>
  );
}

function EmptyDmHero({ name }: { name: string }) {
  return (
    <div className="text-center">
      <span className="bg-secondary text-brand mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full text-base font-semibold">
        {name.slice(0, 1)}
      </span>
      <h2 className="text-foreground text-lg font-semibold">{name} 님과의 메시지</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        둘이서 주고받는 메시지는 상대방과 나만 볼 수 있어요.
      </p>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}:${minute}`;
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "오늘";
  if (diffDays === -1) return "어제";
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday})`;
}
