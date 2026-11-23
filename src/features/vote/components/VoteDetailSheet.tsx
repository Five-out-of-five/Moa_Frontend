"use client";

import { CheckCircle2, EyeOff, History, MoreHorizontal, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

import { closeVoteAction, deleteVoteAction, submitBallotAction } from "../actions";
import { timeRemainingUntil } from "../lib/time-remaining";
import { VoteEditDialog } from "./VoteEditDialog";
import { VoteRevoteDialog } from "./VoteRevoteDialog";

interface Props {
  roomId: number;
  vote: VoteDetail | null;
  /** 로그인 사용자 — 작성자 전용 메뉴 노출 판정에 쓴다. null 이면 로그인 미확인. */
  meAccountId: number | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 수정·수동 마감 결과 — 상위 리스트의 localSummaries/localDetails 를 동기화. */
  onVoteUpdated?(vote: VoteDetail): void;
  /** 삭제 결과 — 상위 리스트에서 제거 + Sheet 를 닫도록 신호. */
  onVoteDeleted?(voteId: number): void;
  /**
   * 재투표 생성 결과 — 상위 리스트에 **새 투표**로 추가하고 새 Sheet 를 열기 위해 상위로 올려 보낸다.
   * (`VotesPageClient.handleCreated` 와 같은 모양.)
   */
  onVoteCreated?(vote: VoteDetail): void;
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
export function VoteDetailSheet({
  roomId,
  vote,
  meAccountId,
  open,
  onOpenChange,
  onVoteUpdated,
  onVoteDeleted,
  onVoteCreated,
}: Props) {
  const [local, setLocal] = useState<VoteDetail | null>(vote);
  const [selected, setSelected] = useState<number[]>(vote?.myOptionIds ?? []);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [revoteOpen, setRevoteOpen] = useState(false);
  const [managePending, startManageTransition] = useTransition();

  // ⚠️ Sheet 가 투표 A → B 로 빠르게 전환될 때, A 의 네트워크 응답이 뒤늦게 돌아와
  //    B 의 상태를 덮는 걸 막기 위한 generation 토큰. `vote` 가 바뀔 때마다 증가하고,
  //    응답 처리 시 요청 시점의 값과 비교해 다르면 결과를 버린다.
  const genRef = useRef(0);
  // ⚠️ 관리 액션(수정·마감·삭제) 응답도 다른 투표로 전환된 뒤 도착할 수 있다. 응답 시점에
  //    현재 열린 투표 ID 와 다르면 **상위 캐시만 갱신** 하고, 로컬 Sheet 상태(local/error/
  //    다이얼로그 열림 등) 는 건드리지 않는다. 그렇지 않으면 B 의 Sheet 에 A 의 내용이
  //    튀어 올라오거나, A 삭제 응답이 B 의 Sheet 를 닫는다 (CodeRabbit).
  const voteIdRef = useRef<number | null>(vote?.voteId ?? null);

  useEffect(() => {
    genRef.current += 1;
    voteIdRef.current = vote?.voteId ?? null;
    setLocal(vote);
    setSelected(vote?.myOptionIds ?? []);
    setError(null);
    // 새 투표로 전환되면 열려 있던 관리 다이얼로그는 닫는다 — 잘못된 투표에 confirm 할 위험 방지.
    setEditOpen(false);
    setCloseConfirmOpen(false);
    setDeleteConfirmOpen(false);
    setRevoteOpen(false);
  }, [vote]);

  const isClosed = local?.status === "CLOSED";
  const isMultiple = local?.voteType === "MULTIPLE";
  const isAuthor =
    local !== null &&
    meAccountId !== null &&
    local.creator.accountId === meAccountId;

  const handleUpdated = (updated: VoteDetail) => {
    // 상위 리스트 캐시는 항상 갱신해 다음에 이 투표를 다시 열 때 최신 값이 보이도록 하고,
    // 현재 Sheet 가 이 투표를 보고 있을 때만 로컬 상태를 바꾼다.
    onVoteUpdated?.(updated);
    if (voteIdRef.current === updated.voteId) setLocal(updated);
  };

  const handleConfirmClose = () => {
    if (!local) return;
    const voteId = local.voteId;
    startManageTransition(async () => {
      let result;
      try {
        result = await closeVoteAction({ roomId, voteId });
      } catch (e) {
        console.error("VoteDetailSheet closeVoteAction rejected:", e);
        if (voteIdRef.current === voteId) {
          setError(
            "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
          );
          setCloseConfirmOpen(false);
        }
        return;
      }
      const isCurrent = voteIdRef.current === voteId;
      if (isCurrent) setCloseConfirmOpen(false);
      if (result.kind === "ok") {
        onVoteUpdated?.(result.vote);
        if (isCurrent) setLocal(result.vote);
      } else if (isCurrent) {
        setError(result.message);
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!local) return;
    const voteId = local.voteId;
    startManageTransition(async () => {
      let result;
      try {
        result = await deleteVoteAction({ roomId, voteId });
      } catch (e) {
        console.error("VoteDetailSheet deleteVoteAction rejected:", e);
        if (voteIdRef.current === voteId) {
          setError(
            "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
          );
          setDeleteConfirmOpen(false);
        }
        return;
      }
      const isCurrent = voteIdRef.current === voteId;
      if (isCurrent) setDeleteConfirmOpen(false);
      if (result.kind === "ok") {
        onVoteDeleted?.(voteId);
        if (isCurrent) onOpenChange(false);
      } else if (isCurrent) {
        setError(result.message);
      }
    });
  };

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
    const requestGen = genRef.current;
    startTransition(async () => {
      let result;
      try {
        result = await submitBallotAction({
          roomId,
          voteId: local.voteId,
          optionIds: selected,
        });
      } catch (e) {
        // Server Action 호출 자체 reject (네트워크 등). 상위 error boundary 로 나가지
        // 않도록 여기서 받는다 (CodeRabbit).
        if (genRef.current !== requestGen) return;
        console.error("VoteDetailSheet submitBallotAction rejected:", e);
        setError(
          "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
        );
        return;
      }
      if (genRef.current !== requestGen) return; // 다른 투표로 전환된 뒤 돌아온 응답은 버림

      switch (result.kind) {
        case "ok":
          setLocal(result.vote);
          return;
        case "closed":
          // 서버가 "이미/방금 마감" 으로 전환됐음을 알린 상태. Sheet 도 CLOSED 결과 화면으로 전환.
          setLocal(result.vote);
          setError(result.message);
          return;
        case "error":
          setError(result.message);
          return;
      }
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // ⚠️ 데스크톱에선 overlay 클릭 · ESC 로 닫을 수 있어 X 가 중복이고 더보기 메뉴(...)를
        //    좌측으로 밀어 레이아웃을 깨뜨린다. 모바일에선 Sheet 가 화면을 덮어 overlay 클릭
        //    경로가 없으므로 X 를 유지해야 닫을 수 있다 (CodeRabbit).
        closeButtonMobileOnly
        className="bg-surface flex w-full flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        {local ? (
          <>
            {/* 모바일 X 자리 확보 — 데스크톱에선 여백 제거. */}
            <SheetHeader className="border-border-soft gap-2 border-b px-5 py-4 pr-12 sm:pr-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={local.status} />
                  <TypeBadge voteType={local.voteType} />
                  {local.anonymous && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <EyeOff className="size-3" />
                      익명
                    </span>
                  )}
                </div>
                {isAuthor && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="투표 관리 메뉴 열기"
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] hover:bg-background focus-visible:outline-none focus-visible:ring-2"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isClosed && (
                        <>
                          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                            수정
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setCloseConfirmOpen(true)}
                          >
                            지금 마감하기
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteConfirmOpen(true)}
                      >
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

              {/* ⚠️ 입력은 **native `<input type="radio"|"checkbox">` + `<label>`** 로 구성한다.
                  스크린리더가 선택 상태·그룹·단축키(화살표·Space) 를 자동 해석하고,
                  브라우저 기본 키보드 포커스 룰이 그대로 작동한다 (CodeRabbit).
                  input 자체는 sr-only 로 숨기고 label 스타일로 Figma 디자인을 유지한다.
                  MULTIPLE 은 체크박스, SINGLE / YES_NO 는 같은 name 의 라디오 그룹.
                  마감된 투표는 input 없이 결과 표시 전용 div 로 렌더. */}
              {isClosed ? (
                <ul className="flex flex-col gap-2">
                  {local.options.map((opt) => {
                    const share =
                      totalCount > 0
                        ? Math.round(((opt.voteCount ?? 0) / totalCount) * 100)
                        : 0;
                    return (
                      <li
                        key={opt.optionId}
                        className={cn(
                          "border-border bg-surface flex flex-col gap-1 rounded-[var(--radius-control)] border px-3 py-2",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <OptionIndicator
                            picked={false}
                            multiple={isMultiple}
                            closed
                            top={opt.top}
                          />
                          <span
                            className={cn(
                              "text-foreground flex-1 text-sm",
                              opt.top && "font-semibold",
                            )}
                          >
                            {opt.content}
                          </span>
                          <span className="text-muted-foreground text-xs font-medium">
                            {opt.voteCount ?? 0}표 · {share}%
                          </span>
                        </div>
                        <Progress
                          value={share}
                          className={cn(
                            "h-1.5",
                            opt.top &&
                              "[&>[data-slot=progress-indicator]]:bg-brand",
                          )}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul
                  role={isMultiple ? "group" : "radiogroup"}
                  aria-label={local.title}
                  className="flex flex-col gap-2"
                >
                  {local.options.map((opt) => {
                    const picked = selected.includes(opt.optionId);
                    const alreadyVoted = local.myOptionIds.includes(
                      opt.optionId,
                    );
                    const inputId = `vote-${local.voteId}-opt-${opt.optionId}`;
                    return (
                      <li key={opt.optionId}>
                        <label
                          htmlFor={inputId}
                          className={cn(
                            "border-border bg-surface flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 transition-colors",
                            "hover:border-brand hover:bg-background",
                            picked &&
                              "border-brand bg-background ring-brand/20 ring-2",
                            "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-0",
                          )}
                        >
                          <input
                            id={inputId}
                            type={isMultiple ? "checkbox" : "radio"}
                            name={`vote-${local.voteId}`}
                            value={opt.optionId}
                            checked={picked}
                            onChange={() => toggleOption(opt.optionId)}
                            className="sr-only"
                          />
                          <OptionIndicator
                            picked={picked}
                            multiple={isMultiple}
                            closed={false}
                          />
                          <span
                            className={cn(
                              "text-foreground flex-1 text-sm",
                              picked && "font-medium",
                            )}
                          >
                            {opt.content}
                          </span>
                          {alreadyVoted && (
                            <CheckCircle2
                              aria-hidden="true"
                              className="text-accent-teal size-4"
                            />
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

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
                  disabled={!canSubmit || pending}
                  onClick={handleSubmit}
                  aria-busy={pending}
                  className="w-full"
                >
                  {pending
                    ? "제출 중…"
                    : local.myOptionIds.length > 0
                      ? "선택 변경하기"
                      : "투표 제출하기"}
                </Button>
              ) : meAccountId !== null ? (
                /* CLOSED 결과를 본 뒤 방 멤버라면 같은 조건으로 다시 투표를 열 수 있다.
                   권한(방 멤버) 체크는 Server Action 에서 다시 한다 — FE 는 노출만 책임.
                   디자인은 Figma 에 재투표 전용 UI 가 없어 투표 제출 버튼과 같은 자리를
                   재사용한다 (`feedback-moa-figma-make-design-only` 룰 준수). */
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRevoteOpen(true)}
                  className="w-full"
                >
                  재투표
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

      {local && isAuthor && !isClosed && (
        <VoteEditDialog
          roomId={roomId}
          voteId={local.voteId}
          initialVersion={local.version}
          initialTitle={local.title}
          initialDeadlineAt={local.deadlineAt}
          initialAnonymous={local.anonymous}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleUpdated}
        />
      )}

      {local && isClosed && onVoteCreated && (
        <VoteRevoteDialog
          roomId={roomId}
          parent={local}
          open={revoteOpen}
          onOpenChange={setRevoteOpen}
          onCreated={(vote) => {
            // 상위의 `handleCreated` 가 setOpenVoteId(새 voteId) 로 Sheet 를 새 투표로
            // **전환** 한다 — 여기서 onOpenChange(false) 를 호출하면 그 전환이 덮여 Sheet 가
            // 닫혀 버린다.
            onVoteCreated(vote);
          }}
        />
      )}

      {local && isAuthor && (
        <>
          <AlertDialog
            open={closeConfirmOpen}
            onOpenChange={(o) => {
              if (!managePending) setCloseConfirmOpen(o);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>지금 마감할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  마감하면 더 이상 참여를 받지 않고 결과가 공개됩니다. 되돌릴 수 없어요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={managePending}>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleConfirmClose();
                  }}
                  disabled={managePending}
                  aria-busy={managePending}
                >
                  {managePending ? "마감 중…" : "마감하기"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={deleteConfirmOpen}
            onOpenChange={(o) => {
              if (!managePending) setDeleteConfirmOpen(o);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>이 투표를 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  투표와 모든 참여 기록이 삭제됩니다. 이 작업은 되돌릴 수 없어요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={managePending}>취소</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    handleConfirmDelete();
                  }}
                  disabled={managePending}
                  aria-busy={managePending}
                >
                  {managePending ? "삭제 중…" : "삭제하기"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
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
