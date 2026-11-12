"use client";

import { ArrowLeft, Calendar, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VoteDetail, VoteSummary } from "@/types/db";

import { timeRemainingUntil } from "../lib/time-remaining";
import { VoteDetailSheet } from "./VoteDetailSheet";

interface Props {
  roomId: number;
  roomName: string;
  summaries: readonly VoteSummary[];
  /**
   * 각 투표의 상세 shape 를 미리 담아 둔다. 목 모드에선 서버 왕복이 없고, 실서버에서도
   * 목록이 보통 10~20개 단위라 상세까지 선패치해 두면 Sheet 열 때 지연이 없다.
   * 개별 lazy fetch 로 바꾸고 싶으면 Server Action 으로 감싼 `getVoteDetailAction` 을
   * 쓰면 된다.
   */
  details: Readonly<Record<number, VoteDetail>>;
}

type TabKey = "OPEN" | "CLOSED";

/**
 * 투표 전체 페이지 — 상단 안내 + 탭(진행 중 / 마감) + 검색 + 카드 그리드.
 * 카드를 누르면 상세가 우측 Sheet 로 열린다 (`VoteDetailSheet`).
 *
 * ⚠️ 생성 / 수정 / 삭제 / 마감 / 재투표는 후속 PR 범위. 상단의 "새 투표" 버튼은 자리만 두고
 *    비활성 상태로 둔다 — 404 링크로 떨어지지 않도록.
 */
export function VotesPageClient({
  roomId,
  roomName,
  summaries,
  details,
}: Props) {
  const [tab, setTab] = useState<TabKey>("OPEN");
  const [query, setQuery] = useState("");
  const [openVoteId, setOpenVoteId] = useState<number | null>(null);
  const detail: VoteDetail | null =
    openVoteId !== null ? (details[openVoteId] ?? null) : null;

  const counts = useMemo(() => {
    const open = summaries.filter((v) => v.status === "OPEN").length;
    const closed = summaries.filter((v) => v.status === "CLOSED").length;
    return { OPEN: open, CLOSED: closed };
  }, [summaries]);

  const visible = useMemo(() => {
    const byTab = summaries.filter((v) => v.status === tab);
    if (!query.trim()) return byTab;
    const q = query.trim().toLowerCase();
    return byTab.filter((v) => v.title.toLowerCase().includes(q));
  }, [summaries, tab, query]);

  const openCard = (voteId: number) => {
    setOpenVoteId(voteId);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            {roomName}
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-bold">투표</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            팀의 의견을 투명하게 모으고 함께 결정하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ⚠️ /rooms/{roomId} 대시보드 라우트가 아직 없어 링크로 두면 404 로 떨어진다.
              대시보드 뼈대 PR 전까지 자리만 유지한 비활성 버튼으로 둔다. */}
          <Button
            type="button"
            variant="ghost"
            disabled
            title="방 대시보드 화면이 준비되면 이동 링크가 열립니다"
          >
            <ArrowLeft className="size-4" />
            대시보드로 돌아가기
          </Button>
          <Button type="button" disabled title="새 투표 만들기는 다음 작업에서 열립니다">
            <Plus className="size-4" />새 투표
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="투표 상태 필터"
          className="flex items-center gap-1"
        >
          <TabButton
            active={tab === "OPEN"}
            onClick={() => setTab("OPEN")}
            label="진행 중"
            count={counts.OPEN}
          />
          <TabButton
            active={tab === "CLOSED"}
            onClick={() => setTab("CLOSED")}
            label="마감"
            count={counts.CLOSED}
          />
        </div>
        <label className="relative max-w-xs flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="투표 검색"
            aria-label="투표 검색"
            className="border-border bg-background focus:ring-ring h-9 w-full rounded-[var(--radius-control)] border py-1 pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState tab={tab} query={query} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((v) => (
            <li key={v.voteId}>
              <VoteCard summary={v} onClick={() => openCard(v.voteId)} />
            </li>
          ))}
        </ul>
      )}

      <VoteDetailSheet
        roomId={roomId}
        vote={detail}
        open={openVoteId !== null}
        onOpenChange={(o) => {
          if (!o) setOpenVoteId(null);
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-brand"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
          active ? "bg-brand text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function VoteCard({
  summary,
  onClick,
}: {
  summary: VoteSummary;
  onClick: () => void;
}) {
  const typeLabel =
    summary.voteType === "SINGLE"
      ? "단일 선택"
      : summary.voteType === "MULTIPLE"
        ? "복수 선택"
        : "찬반";
  const isClosed = summary.status === "CLOSED";
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border hover:border-brand bg-surface flex w-full flex-col gap-3 rounded-[var(--radius-card)] border px-4 py-4 text-left transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            isClosed
              ? "bg-muted text-muted-foreground"
              : "bg-secondary text-brand",
          )}
        >
          {isClosed ? "마감" : "진행 중"}
        </span>
        <span className="bg-background text-muted-foreground inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
          {typeLabel}
        </span>
      </div>
      <h3 className="text-foreground text-base font-semibold leading-snug">
        {summary.title}
      </h3>
      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          {formatDeadline(summary.deadlineAt)}
          <span className="ml-1 font-medium">
            {isClosed ? "마감됨" : timeRemainingUntil(summary.deadlineAt)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" />
          {summary.participantCount}명 참여 · 전체 {summary.memberCount}명
        </span>
      </div>
      <div className="border-border-soft flex items-center justify-between border-t pt-2 text-xs">
        <span className="text-muted-foreground">
          {summary.votedByMe
            ? isClosed
              ? "내 투표 포함"
              : "참여 완료 · 변경 가능"
            : isClosed
              ? "미참여"
              : "아직 참여하지 않음"}
        </span>
        <span className="text-brand font-medium">
          {isClosed ? "결과 보기 →" : "투표하기 →"}
        </span>
      </div>
    </button>
  );
}

function EmptyState({ tab, query }: { tab: TabKey; query: string }) {
  return (
    <div className="text-muted-foreground border-border-soft bg-background flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed px-6 py-16 text-center text-sm">
      {query.trim()
        ? "검색 결과가 없습니다."
        : tab === "OPEN"
          ? "진행 중인 투표가 없습니다."
          : "마감된 투표가 아직 없습니다."}
    </div>
  );
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${month}월 ${day}일 ${period} ${hour12}:${minute}`;
}
