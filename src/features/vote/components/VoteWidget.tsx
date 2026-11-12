import { ChevronRight, Vote as VoteIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { VoteSummary } from "@/types/db";

import { timeRemainingUntil } from "../lib/time-remaining";

interface Props {
  roomId: number;
  /** 대시보드 위젯에는 진행 중인 투표 몇 개만 요약으로 띄운다 (3~5개 권장). */
  summaries: readonly VoteSummary[];
  /** 호출부가 빈 상태 커스터마이즈를 원할 때 — 기본은 "진행 중인 투표가 없어요". */
  emptyMessage?: string;
}

/**
 * 대시보드 메인에 올라가는 투표 **압축 위젯**. 전체 페이지(`/rooms/{id}/votes`) 와 소스는
 * 같되 카드 대신 리스트 형태로 공간을 아껴 쓴다. 각 행을 누르면 전체 페이지로 이동한다.
 *
 * ⚠️ 위젯은 **대시보드 레이아웃이 확정된 뒤** 올라간다 — 이번 PR 에선 standalone 컴포넌트로
 *    두고 대시보드 배치는 후속 작업에서 import 한다.
 */
export function VoteWidget({ roomId, summaries, emptyMessage }: Props) {
  const open = summaries.filter((v) => v.status === "OPEN");
  const shown = open.slice(0, 4);

  return (
    <section
      aria-label="투표 위젯"
      className="border-border-soft bg-surface flex min-h-[220px] flex-col gap-3 rounded-[var(--radius-card)] border px-4 py-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
          <VoteIcon className="text-brand size-4" />
          투표
        </h2>
        <Link
          href={`/rooms/${roomId}/votes`}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          전체 보기
        </Link>
      </header>

      {shown.length === 0 ? (
        <p className="text-muted-foreground flex flex-1 items-center justify-center text-center text-xs">
          {emptyMessage ?? "진행 중인 투표가 없어요."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((v) => (
            <li key={v.voteId}>
              <Link
                href={`/rooms/${roomId}/votes`}
                className="hover:bg-secondary flex items-center gap-2 rounded-[var(--radius-control)] px-2 py-2 text-left transition-colors"
              >
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    v.votedByMe
                      ? "bg-muted text-muted-foreground"
                      : "bg-secondary text-brand",
                  )}
                >
                  {v.votedByMe ? "참여 완료" : "참여 필요"}
                </span>
                <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                  {v.title}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {timeRemainingUntil(v.deadlineAt)}
                </span>
                <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
