"use client";

import { CheckCircle2, EyeOff, History, Users } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { VoteDetail } from "@/types/db";

import { submitBallotAction } from "../actions";
import { timeRemainingUntil } from "../lib/time-remaining";

interface Props {
  roomId: number;
  vote: VoteDetail | null;
  open: boolean;
  onOpenChange(open: boolean): void;
}

/**
 * 투표 상세 Sheet — 목록에서 카드 클릭 시 우측에 열린다.
 *
 * ⚠️ 유형별 입력 UI 를 분기한다:
 *   - SINGLE / YES_NO : 라디오 (1개 선택)
 *   - MULTIPLE : 체크박스 (최대 `maxSelectCount` 개)
 * ⚠️ 마감(`CLOSED`) 투표는 득표 수·진척 바로 결과 표시. 입력 UI 는 비활성.
 * ⚠️ 명세: 진행 중엔 `voteCount` 가 내려오지 않는다. 결과 공개는 마감 후만.
 * ⚠️ 참여·수정 이후 서버가 돌려준 `VoteDetail` 로 로컬 상태를 갱신한다 — 참여 인원 등
 *    집계가 즉시 반영되도록.
 */
export function VoteDetailSheet({ roomId, vote, open, onOpenChange }: Props) {
  const [local, setLocal] = useState<VoteDetail | null>(vote);
  const [selected, setSelected] = useState<number[]>(vote?.myOptionIds ?? []);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(vote);
    setSelected(vote?.myOptionIds ?? []);
    setError(null);
  }, [vote]);

  const isClosed = local?.status === "CLOSED";
  const isMultiple = local?.voteType === "MULTIPLE";

  const totalCount = useMemo(() => {
    if (!local || !isClosed) return 0;
    return local.options.reduce((sum, o) => sum + (o.voteCount ?? 0), 0);
  }, [local, isClosed]);

  const toggleOption = (optionId: number) => {
    if (!local || isClosed) return;
    setError(null);
    if (isMultiple) {
      setSelected((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : prev.length >= local.maxSelectCount
            ? prev
            : [...prev, optionId],
      );
    } else {
      setSelected([optionId]);
    }
  };

  const canSubmit =
    !pending &&
    !isClosed &&
    selected.length > 0 &&
    JSON.stringify([...selected].sort()) !==
      JSON.stringify([...(local?.myOptionIds ?? [])].sort());

  const handleSubmit = () => {
    if (!local || !canSubmit) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await submitBallotAction({
          roomId,
          voteId: local.voteId,
          optionIds: selected,
        });
        setLocal(next);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "투표 제출에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
        );
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-surface flex w-full flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        {local ? (
          <>
            <SheetHeader className="border-border-soft gap-2 border-b px-5 py-4">
              <div className="flex items-center gap-1.5">
                <StatusBadge status={local.status} />
                <TypeBadge voteType={local.voteType} />
                {local.anonymous && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <EyeOff className="size-3" />
                    익명
                  </span>
                )}
              </div>
              <SheetTitle className="text-foreground text-lg font-semibold leading-snug">
                {local.title}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground text-xs">
                {local.creator.displayName} 님이 만들었어요 ·{" "}
                {isClosed
                  ? closeReasonLabel(local.closeReason)
                  : timeRemainingUntil(local.deadlineAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!isClosed && (
                <p className="bg-secondary text-muted-foreground mb-3 rounded-[var(--radius-control)] px-3 py-2 text-xs">
                  투표가 마감될 때까지 선택 결과는 공개되지 않습니다.
                </p>
              )}

              <ul className="flex flex-col gap-2">
                {local.options.map((opt) => {
                  const picked = selected.includes(opt.optionId);
                  const alreadyVoted = local.myOptionIds.includes(opt.optionId);
                  const share =
                    isClosed && totalCount > 0
                      ? Math.round(((opt.voteCount ?? 0) / totalCount) * 100)
                      : 0;
                  return (
                    <li key={opt.optionId}>
                      <button
                        type="button"
                        onClick={() => toggleOption(opt.optionId)}
                        disabled={isClosed}
                        className={cn(
                          "border-border bg-surface flex w-full flex-col gap-1 rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors",
                          !isClosed && "hover:border-brand hover:bg-background",
                          picked &&
                            !isClosed &&
                            "border-brand bg-background ring-brand/20 ring-2",
                          isClosed && "cursor-default",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <OptionIndicator
                            picked={picked}
                            multiple={isMultiple}
                            closed={isClosed}
                            top={opt.top}
                          />
                          <span
                            className={cn(
                              "text-foreground flex-1 text-sm",
                              picked && !isClosed && "font-medium",
                              opt.top && isClosed && "font-semibold",
                            )}
                          >
                            {opt.content}
                          </span>
                          {isClosed && (
                            <span className="text-muted-foreground text-xs font-medium">
                              {opt.voteCount ?? 0}표 · {share}%
                            </span>
                          )}
                          {!isClosed && alreadyVoted && (
                            <CheckCircle2 className="text-accent-teal size-4" />
                          )}
                        </div>
                        {isClosed && (
                          <Progress
                            value={share}
                            className={cn(
                              "h-1.5",
                              opt.top && "[&>[data-slot=progress-indicator]]:bg-brand",
                            )}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {!isClosed && (
                <p className="text-muted-foreground mt-3 text-xs">
                  {isMultiple
                    ? `최대 ${local.maxSelectCount}개까지 선택할 수 있어요.`
                    : "하나의 항목을 선택할 수 있어요."}
                </p>
              )}
              {isClosed && local.tied && (
                <p className="text-warning mt-3 text-xs font-medium">
                  동점으로 마감되었습니다. 재투표가 필요할 수 있어요.
                </p>
              )}
              {error && (
                <p className="text-destructive mt-3 text-xs">{error}</p>
              )}
            </div>

            <div className="border-border-soft bg-background space-y-2 border-t px-5 py-3">
              {!isClosed ? (
                <Button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className="w-full"
                >
                  {local.myOptionIds.length > 0 ? "선택 변경하기" : "투표 제출하기"}
                </Button>
              ) : (
                <Button type="button" disabled className="w-full">
                  마감된 투표
                </Button>
              )}
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  전체 {local.memberCount}명 중 {local.participantCount}명 참여
                </span>
                <span className="inline-flex items-center gap-1">
                  <History className="size-3.5" />v{local.version}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-10 text-sm">
            투표 정보를 불러오지 못했습니다.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatusBadge({ status }: { status: VoteDetail["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "OPEN"
          ? "bg-secondary text-brand"
          : "bg-muted text-muted-foreground",
      )}
    >
      {status === "OPEN" ? "진행 중" : "마감"}
    </span>
  );
}

function TypeBadge({ voteType }: { voteType: VoteDetail["voteType"] }) {
  const label =
    voteType === "SINGLE"
      ? "단일 선택"
      : voteType === "MULTIPLE"
        ? "복수 선택"
        : "찬반";
  return (
    <span className="bg-background text-muted-foreground inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
      {label}
    </span>
  );
}

function OptionIndicator({
  picked,
  multiple,
  closed,
  top,
}: {
  picked: boolean;
  multiple: boolean;
  closed: boolean;
  top?: boolean;
}) {
  if (closed) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
          top
            ? "bg-brand border-brand text-white"
            : "border-border bg-background",
        )}
      >
        {top && <CheckCircle2 className="size-3" />}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center border transition-colors",
        multiple ? "rounded-[4px]" : "rounded-full",
        picked ? "bg-brand border-brand" : "border-border bg-background",
      )}
    >
      {picked && (
        <CheckCircle2
          className={cn(multiple ? "size-3" : "size-2.5", "text-white")}
        />
      )}
    </span>
  );
}

function closeReasonLabel(reason: VoteDetail["closeReason"]): string {
  switch (reason) {
    case "DEADLINE":
      return "기한 종료로 마감";
    case "ALL_VOTED":
      return "전원 참여로 자동 마감";
    case "MANUAL":
      return "수동 마감";
    case "NO_PARTICIPANT":
      return "참여자 없이 마감";
    default:
      return "마감됨";
  }
}
