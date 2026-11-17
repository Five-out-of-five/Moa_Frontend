"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  formatDateDivider,
  formatTime,
  toLocalDateKey,
  toUtcDateKey,
} from "../lib/time";
import type { ChatMessage } from "../types";

interface Props {
  messages: readonly ChatMessage[];
  roomId?: number;
  /** 메시지가 하나도 없을 때 렌더할 Hero. 채널/DM 각각 자기 안내 문구를 넘긴다. */
  emptyState: React.ReactNode;
}

/**
 * 메시지 리스트 — 날짜 구분선 + 같은 작성자 연속 메시지 그룹화 + 하단 자동 스크롤.
 *
 * ⚠️ 그룹화 규칙 (Figma Make):
 *    - 직전 메시지와 **같은 작성자** 이고
 *    - 직전 메시지와 **같은 날짜(YYYY-MM-DD)** 이며
 *    - 직전 메시지와의 간격이 **5분 이내** 일 때
 *    아바타·이름을 숨기고 들여쓰기만 유지한다. 그 외에는 새 그룹으로 시작.
 *
 * ⚠️ **SSR·1차 CSR 은 UTC 기준, mount 후엔 로컬 TZ 로 재그룹** 한다 (CodeRabbit).
 *    로컬 TZ 를 처음부터 쓰면 서버·클라 결과가 달라 날짜 구분선·그룹 구조가 어긋나거나
 *    hydration 경고가 뜬다. `mounted` state 를 토글하는 순간 전체가 로컬 TZ 기준으로
 *    자연스럽게 다시 그려진다.
 *
 * ⚠️ 자동 스크롤 가드: 사용자가 이미 위로 스크롤해서 과거 메시지를 보는 중이라면 신규 메시지가
 *    들어와도 **점프하지 않는다** — 리스트 바닥에서 약 80px 이내일 때만 자동 bottom 이동.
 */
export function MessageList({ messages, emptyState, roomId }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [mounted, setMounted] = useState(false);

  // 포맷·그룹 키는 mount 전 UTC / 후 로컬 분기.
  useEffect(() => setMounted(true), []);

  // 첫 렌더에선 바닥으로 바로 보낸다 — 가장 최근 메시지가 보이는 게 기본값.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // 신규 메시지가 들어올 때마다 바닥 추적. isAtBottom 인 사용자에게만 자동 스크롤.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottom) el.scrollTop = el.scrollHeight;
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distance < 80);
  };

  const grouped = useMemo(
    () => groupMessages(messages, mounted),
    [messages, mounted],
  );

  if (messages.length === 0) {
    return (
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="flex h-full items-center justify-center px-6 py-10">
          {emptyState}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex max-w-[720px] flex-col gap-1 px-6 py-6">
        {grouped.map((group, i) => (
          <div key={group.dateKey + "-" + i} className="flex flex-col gap-1">
            {group.showDateDivider && (
              <DateDivider
                label={formatDateDivider(group.items[0]!.createdAt, mounted)}
              />
            )}
            {group.items.map((msg, j) => (
              <MessageRow
                key={msg.id}
                message={msg}
                roomId={roomId}
                isFirstInGroup={j === 0}
                useLocal={mounted}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 메시지를 "같은 작성자 + 같은 날짜 + 5분 이내" 묶음으로 쪼갠다. 각 묶음은 함께 들여쓰기로
 * 렌더되며, 날짜 경계에서는 `showDateDivider: true` 로 표시해 상위에서 구분선을 띄운다.
 */
function groupMessages(
  messages: readonly ChatMessage[],
  useLocal: boolean,
): {
  dateKey: string;
  showDateDivider: boolean;
  items: ChatMessage[];
}[] {
  const dateKeyFn = useLocal ? toLocalDateKey : toUtcDateKey;
  const groups: {
    dateKey: string;
    showDateDivider: boolean;
    items: ChatMessage[];
  }[] = [];
  let lastDateKey = "";
  for (const msg of messages) {
    const dateKey = dateKeyFn(msg.createdAt);
    const last = groups[groups.length - 1];
    const lastMsg = last?.items[last.items.length - 1];
    const sameAuthor = lastMsg?.author.accountId === msg.author.accountId;
    const sameDay = last?.dateKey === dateKey;
    const withinGroupWindow =
      lastMsg !== undefined &&
      new Date(msg.createdAt).getTime() -
        new Date(lastMsg.createdAt).getTime() <=
        5 * 60 * 1000;

    if (last && sameAuthor && sameDay && withinGroupWindow) {
      last.items.push(msg);
    } else {
      groups.push({
        dateKey,
        showDateDivider: dateKey !== lastDateKey,
        items: [msg],
      });
      lastDateKey = dateKey;
    }
  }
  return groups;
}

function MessageRow({
  message,
  roomId,
  isFirstInGroup,
  useLocal,
}: {
  message: ChatMessage;
  roomId?: number;
  isFirstInGroup: boolean;
  useLocal: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 px-2 py-0.5 rounded-[var(--radius-control)]",
        "hover:bg-muted/40",
        message.pending && "opacity-60",
      )}
    >
      <div className="w-8 shrink-0">
        {isFirstInGroup ? (
          roomId ? (
            <Link
              href={`/rooms/${roomId}/members/${message.author.accountId}`}
              aria-label={`${message.author.displayName} 프로필 보기`}
              className="focus-visible:ring-ring block rounded-sm focus-visible:ring-2"
            >
              <Avatar name={message.author.displayName} />
            </Link>
          ) : (
            <Avatar name={message.author.displayName} />
          )
        ) : (
          <span className="block h-full" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {isFirstInGroup && (
          <div className="flex items-baseline gap-2 pb-0.5">
            <span className="text-foreground text-sm font-semibold">
              {message.author.displayName}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {formatTime(message.createdAt, useLocal)}
            </span>
            {message.pending && (
              <span className="text-muted-foreground text-[11px]">
                · 보내는 중…
              </span>
            )}
          </div>
        )}
        {/* ⚠️ 긴 URL 이나 공백 없는 토큰이 메시지 폭을 넘어가 가로 스크롤을 만들지 않도록
               `overflow-wrap: anywhere` 를 걸어 임의 지점에서 줄바꿈 (CodeRabbit). */}
        <p className="text-foreground [overflow-wrap:anywhere] whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.slice(0, 1);
  return (
    <span
      aria-hidden="true"
      className="bg-brand text-sm font-semibold text-white flex size-8 items-center justify-center rounded-[var(--radius-control)]"
    >
      {initial}
    </span>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3" role="separator" aria-label={label}>
      <span className="bg-border-soft h-px flex-1" />
      <span className="text-muted-foreground text-[11px] font-medium">
        {label}
      </span>
      <span className="bg-border-soft h-px flex-1" />
    </div>
  );
}
