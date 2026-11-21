"use client";

import { ArrowLeft, Hash, Lock, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { ChatChannel, ChatMessage } from "../types";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

interface Props {
  channel: ChatChannel;
  initialMessages: readonly ChatMessage[];
  /** 로그인 사용자 — 낙관적 전송 시 작성자 이름으로 쓴다. null 이면 입력창 비활성. */
  me: { accountId: number; displayName: string } | null;
}

/**
 * 채널 메시지 페이지 — 헤더 + 메시지 리스트 + 입력창 수직 레이아웃.
 *
 * ⚠️ 쓰기(전송) 는 **로컬 state 에만 낙관적 추가** 하고, 서버 왕복은 하지 않는다 — WebSocket
 *    연결이 붙는 후속 PR 에서 소켓 전송 + 서버 ack 로 전환할 자리. 그래서 전송 결과도 "보낸 것
 *    처럼" 보이지만 리로드하면 사라진다 (목 데이터 특성).
 * ⚠️ 쉘 레이아웃의 `<main>` 기본 패딩(px-6 py-6) 때문에 메시지 영역이 좁아 보이지 않도록
 *    컨테이너는 `-mx-6 -my-6` 로 음수 마진을 쓰고 자체 패딩을 가진다.
 */
export function ChannelPageClient({ channel, initialMessages, me }: Props) {
  const [messages, setMessages] = useState<readonly ChatMessage[]>(initialMessages);

  const handleSend = (content: string) => {
    if (!me) return;
    // ⚠️ 음수 id — 서버에서 받은 real id 와 충돌하지 않도록 로컬 임시 id 는 음수로.
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
    // WS 가 붙으면 여기서 ack 응답을 받아 pending → false, id → real 로 덮어쓰면 된다.
  };

  const KindIcon = channel.kind === "PRIVATE" ? Lock : Hash;

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100dvh-var(--header-height))] flex-col">
      <header className="border-border-soft bg-surface flex items-center justify-between gap-3 border-b px-6 py-3">
        <div className="min-w-0 flex items-center gap-2.5">
          <KindIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-foreground truncate text-base font-semibold">
              {channel.name}
            </h1>
            {channel.topic && (
              <p className="text-muted-foreground truncate text-xs">
                {channel.topic}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {typeof channel.memberCount === "number" && (
            <span
              className="bg-background text-muted-foreground border-border inline-flex items-center gap-1 rounded-[var(--radius-control)] border px-2 py-1 text-xs"
              aria-label={`멤버 ${channel.memberCount}명`}
            >
              <Users className="size-3.5" />
              {channel.memberCount}
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link
              href={`/rooms/${channel.roomId}`}
              className="inline-flex items-center gap-1"
            >
              <ArrowLeft className="size-4" />
              대시보드로 돌아가기
            </Link>
          </Button>
        </div>
      </header>

      <MessageList
        roomId={channel.roomId}
        messages={messages}
        emptyState={
          <EmptyChannelHero
            name={channel.name}
            kind={channel.kind}
            topic={channel.topic}
          />
        }
      />

      <div className="border-border-soft bg-background border-t px-6 py-3">
        <MessageComposer
          toneTarget={{ kind: "CHAT", roomId: channel.roomId, channelId: channel.id }}
          placeholder={`${channel.name} 채널에 메시지 보내기`}
          disabledReason={me ? undefined : "로그인 후 메시지를 보낼 수 있어요."}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}

/** 메시지가 하나도 없는 채널의 Hero — Figma Make 디자인의 중앙 안내 블록 톤. */
function EmptyChannelHero({
  name,
  kind,
  topic,
}: {
  name: string;
  kind: ChatChannel["kind"];
  topic?: string;
}) {
  const Icon = kind === "PRIVATE" ? Lock : Hash;
  return (
    <div className="text-center">
      <span className="bg-secondary text-brand mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-foreground text-lg font-semibold">{name}</h2>
      {topic ? (
        <p className="text-muted-foreground mt-1 text-sm">{topic}</p>
      ) : (
        <p className="text-muted-foreground mt-1 text-sm">
          {kind === "PRIVATE"
            ? "초대된 멤버만 볼 수 있는 비공개 채널입니다."
            : "방 안 누구나 참여할 수 있는 공개 채널입니다."}
        </p>
      )}
      <p className="text-muted-foreground mt-3 text-xs">
        이 채널의 첫 메시지를 남겨 보세요.
      </p>
    </div>
  );
}

// formatTime / formatDateDivider 는 `../lib/time` 으로 옮겨 MessageList 가 내부에서 쓴다.
// mount 전후로 UTC ↔ 로컬 TZ 를 전환해야 해서 MessageList 가 자체적으로 소유하는 편이 깔끔.
