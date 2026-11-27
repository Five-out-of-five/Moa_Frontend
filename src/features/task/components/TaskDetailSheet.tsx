"use client";

import { Calendar, History, MoreHorizontal, User } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MemberProfileLink } from "@/features/room/profile/MemberProfileLink";
import { cn } from "@/lib/utils";
import type { MemberRef, TaskDetail, TaskStatus } from "@/types/db";

import {
  changeTaskStatusAction,
  deleteTaskAction,
  rejectTaskAction,
} from "../actions";
import {
  formatDDay,
  TASK_HISTORY_LABEL,
  TASK_PRIORITY_CLASS,
  TASK_PRIORITY_LABEL,
  TASK_SOURCE_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from "../lib/labels";
import { TaskAttachmentsSection } from "./TaskAttachmentsSection";
import { TaskEditDialog } from "./TaskEditDialog";

interface Props {
  roomId: number;
  task: TaskDetail | null;
  /** 수정 Dialog 담당자 셀렉터에 쓸 활성 방 멤버 목록. */
  members: readonly MemberRef[];
  /** 로그인 사용자 — 작성자/담당자 전용 메뉴 노출 판정에 쓴다. */
  meAccountId: number | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 수정 결과 — 상위 리스트의 localDetails/localSummaries 를 동기화. */
  onTaskUpdated?(task: TaskDetail): void;
  /** 삭제 결과 — 상위 리스트에서 제거 + Sheet 닫기. */
  onTaskDeleted?(taskId: number): void;
}

/**
 * 업무 상세 Sheet — 보드에서 카드 클릭 시 우측에 열린다.
 *
 * ⚠️ 쓰기 액션:
 *   - **상태 변경** : body 안 상태 버튼 (즉시 적용, `changeTaskStatusAction`)
 *   - **수정** : 더보기 메뉴 → `TaskEditDialog` (제목·설명·상태·담당자·우선순위·마감일 일괄)
 *   - **반려** : 더보기 메뉴 → AlertDialog confirm. 담당자만, DONE 제외
 *   - **삭제** : 더보기 메뉴 → AlertDialog confirm. 작성자만
 *
 * ⚠️ 투표 상세 Sheet (`VoteDetailSheet`) 와 같은 DropdownMenu 패턴을 재사용 — 반려·재투표
 *    UI 는 Figma 에 별도로 그려져 있지 않아, 디자인 창작 대신 기존 룩을 그대로 쓴다.
 * ⚠️ 상세 Sheet 가 업무 A → B 로 빠르게 전환될 때 뒤늦게 돌아오는 응답이 다른 업무를
 *    덮지 않도록 `taskIdRef` + `genRef` 로 레이스 가드 (투표 Sheet 와 동일).
 */
export function TaskDetailSheet({
  roomId,
  task,
  members,
  meAccountId,
  open,
  onOpenChange,
  onTaskUpdated,
  onTaskDeleted,
}: Props) {
  const [local, setLocal] = useState<TaskDetail | null>(task);
  const [pending, startTransition] = useTransition();
  const [managePending, startManageTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Sheet 가 업무 A → B 로 바뀔 때, A 의 뒤늦은 응답이 B 를 덮거나 B 에 A 의 에러를 출력하지
  // 않도록 generation 토큰으로 가드한다.
  const genRef = useRef(0);
  // 관리 액션(수정·반려·삭제) 응답이 다른 업무로 전환된 뒤 도착할 수 있다. 응답 시점에 현재
  // 열린 업무 ID 와 다르면 **상위 캐시만 갱신** 하고 로컬 Sheet 상태는 건드리지 않는다
  // (VoteDetailSheet 와 동일 패턴).
  const taskIdRef = useRef<number | null>(task?.taskId ?? null);

  useEffect(() => {
    genRef.current += 1;
    taskIdRef.current = task?.taskId ?? null;
    setLocal(task);
    setError(null);
    // 다른 업무로 전환되면 열려 있던 관리 다이얼로그는 닫는다 — 잘못된 대상에 confirm 되는 걸 막는다.
    setEditOpen(false);
    setRejectConfirmOpen(false);
    setDeleteConfirmOpen(false);
  }, [task]);

  const isAuthor =
    local !== null &&
    meAccountId !== null &&
    local.registrant.accountId === meAccountId;
  const isAssignee =
    local !== null &&
    meAccountId !== null &&
    local.assignee !== null &&
    local.assignee.accountId === meAccountId;
  // 수정은 작성자/담당자 모두 가능. 반려는 담당자 한정 + DONE 제외. 삭제는 작성자 한정.
  const canEdit = isAuthor || isAssignee;
  const canReject = isAssignee && local?.status !== "DONE";
  const canDelete = isAuthor;
  const canManage = canEdit || canReject || canDelete;

  const handleStatusChange = (next: TaskStatus) => {
    if (!local || pending || local.status === next) return;
    setError(null);
    const requestGen = genRef.current;
    startTransition(async () => {
      // Server Action 호출 자체가 reject 될 수 있다(네트워크 끊김 등). 그대로 두면 React 가
      // startTransition 안의 rejection 을 상위 error boundary 로 올려 Sheet 가 통째로 교체될
      // 수 있다. 여기서 받아 retryable 에러로 사용자에게 보여준다 (CodeRabbit).
      let result;
      try {
        result = await changeTaskStatusAction({
          roomId,
          taskId: local.taskId,
          status: next,
          version: local.version,
        });
      } catch (e) {
        if (genRef.current !== requestGen) return;
        console.error("TaskDetailSheet changeTaskStatusAction rejected:", e);
        setError("요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
        return;
      }
      if (genRef.current !== requestGen) return;

      switch (result.kind) {
        case "ok":
          setLocal(result.task);
          // 상위 리스트 (요약 + 상세) 동기화
          onTaskUpdated?.(result.task);
          return;
        case "conflict":
        case "ok_detail_stale":
        case "error":
          setError(result.message);
          return;
      }
    });
  };

  const handleUpdated = (updated: TaskDetail) => {
    onTaskUpdated?.(updated);
    if (taskIdRef.current === updated.taskId) setLocal(updated);
  };

  const handleConfirmReject = () => {
    if (!local) return;
    const taskId = local.taskId;
    startManageTransition(async () => {
      let result;
      try {
        result = await rejectTaskAction({
          roomId,
          taskId,
          version: local.version,
        });
      } catch (e) {
        console.error("TaskDetailSheet rejectTaskAction rejected:", e);
        if (taskIdRef.current === taskId) {
          setError(
            "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
          );
          setRejectConfirmOpen(false);
        }
        return;
      }
      const isCurrent = taskIdRef.current === taskId;
      if (isCurrent) setRejectConfirmOpen(false);
      if (result.kind === "ok") {
        onTaskUpdated?.(result.task);
        if (isCurrent) setLocal(result.task);
      } else if (isCurrent) {
        setError(result.message);
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!local) return;
    const taskId = local.taskId;
    startManageTransition(async () => {
      let result;
      try {
        result = await deleteTaskAction({ roomId, taskId });
      } catch (e) {
        console.error("TaskDetailSheet deleteTaskAction rejected:", e);
        if (taskIdRef.current === taskId) {
          setError(
            "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
          );
          setDeleteConfirmOpen(false);
        }
        return;
      }
      const isCurrent = taskIdRef.current === taskId;
      if (isCurrent) setDeleteConfirmOpen(false);
      if (result.kind === "ok") {
        onTaskDeleted?.(taskId);
        if (isCurrent) onOpenChange(false);
      } else if (isCurrent) {
        setError(result.message);
      }
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          // ⚠️ 데스크톱에선 overlay 클릭 · ESC 로 닫을 수 있어 X 가 중복이고, 더보기 메뉴(...)를
          //    좌측으로 밀어 레이아웃을 깨뜨리기만 한다. 반대로 모바일에선 Sheet 가 화면을 거의
          //    다 덮어 overlay 클릭이 불가하므로 X 를 남겨 둬야 닫을 수 있다 (CodeRabbit).
          closeButtonMobileOnly
          className="bg-surface flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
        >
          {local ? (
            <>
              {/* 모바일에서는 X 가 우상단에 보이므로 더보기 메뉴와 겹치지 않게 그 폭만큼 여백을 확보한다. */}
              <SheetHeader className="border-border-soft gap-2 border-b px-5 py-4 pr-12 sm:pr-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        TASK_PRIORITY_CLASS[local.priority],
                      )}
                    >
                      우선순위 · {TASK_PRIORITY_LABEL[local.priority]}
                    </span>
                    {local.source.type !== "NONE" && (
                      <span className="bg-background text-muted-foreground border-border inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium">
                        {TASK_SOURCE_LABEL[local.source.type]}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="업무 관리 메뉴 열기"
                          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring hover:bg-background inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] focus-visible:outline-none focus-visible:ring-2"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                            수정
                          </DropdownMenuItem>
                        )}
                        {canReject && (
                          <DropdownMenuItem
                            onSelect={() => setRejectConfirmOpen(true)}
                          >
                            반려
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <>
                            {(canEdit || canReject) && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteConfirmOpen(true)}
                            >
                              삭제
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <SheetTitle className="text-foreground text-lg leading-snug font-semibold">
                  {local.title}
                </SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs">
                  <MemberProfileLink
                    roomId={roomId}
                    accountId={local.registrant.accountId}
                    name={local.registrant.displayName}
                    imageUrl={local.registrant.profileImageUrl}
                  />
                  <span> · {formatDDay(local.dDay, local.overdue)}</span>
                  {local.overdue && (
                    <span className="text-destructive ml-2 font-medium">지연</span>
                  )}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <section>
                  <h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
                    상태
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {TASK_STATUS_ORDER.map((s) => {
                      const active = local.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleStatusChange(s)}
                          disabled={pending || active}
                          className={cn(
                            "inline-flex items-center rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-medium transition-colors",
                            active
                              ? "bg-brand text-white"
                              : "border-border bg-background text-muted-foreground hover:border-brand hover:text-brand border",
                            pending && "opacity-60",
                          )}
                        >
                          {TASK_STATUS_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                  {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
                </section>

                <section>
                  <h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
                    담당자
                  </h3>
                  {local.assignee ? (
                    <MemberProfileLink
                      roomId={roomId}
                      accountId={local.assignee.accountId}
                      name={local.assignee.displayName}
                      imageUrl={local.assignee.profileImageUrl}
                    />
                  ) : (
                    <div className="text-foreground flex items-center gap-2 text-sm">
                      <User aria-hidden="true" className="text-muted-foreground size-4" />
                      미담당
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
                    기한
                  </h3>
                  <div className="text-foreground flex items-center gap-2 text-sm">
                    <Calendar className="text-muted-foreground size-4" />
                    {local.dueDate ?? "기한 없음"}
                  </div>
                </section>

                {local.description && (
                  <section>
                    <h3 className="text-muted-foreground mb-1.5 text-xs font-medium">
                      설명
                    </h3>
                    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {local.description}
                    </p>
                  </section>
                )}

                <TaskAttachmentsSection
                  roomId={roomId}
                  taskId={local.taskId}
                  files={local.files}
                  canEdit={canEdit}
                />

                <section>
                  <h3 className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium">
                    <History className="size-3.5" />
                    변경 이력
                  </h3>
                  <ul className="border-border-soft flex flex-col gap-2 border-l pl-3">
                    {local.history.map((h, i) => (
                      <li key={i} className="text-muted-foreground text-xs">
                        <span className="text-foreground font-medium">
                          {TASK_HISTORY_LABEL[h.historyType]}
                        </span>
                        {h.fromStatus && h.toStatus && (
                          <span className="ml-1">
                            · {TASK_STATUS_LABEL[h.fromStatus]} → {TASK_STATUS_LABEL[h.toStatus]}
                          </span>
                        )}
                        {h.historyType === "ASSIGNEE_CHANGED" && (
                          <span className="ml-1">
                            · {h.fromAssignee?.displayName ?? "미담당"} →{" "}
                            {h.toAssignee?.displayName ?? "미담당"}
                          </span>
                        )}
                        <span className="ml-1">
                          · {h.actor.displayName} · {formatHistoryTime(h.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center p-10 text-sm">
              업무 정보를 불러오지 못했습니다.
            </div>
          )}
        </SheetContent>
      </Sheet>

      {local && canEdit && (
        <TaskEditDialog
          roomId={roomId}
          task={local}
          members={members}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleUpdated}
        />
      )}

      <AlertDialog
        open={rejectConfirmOpen}
        onOpenChange={(next) => {
          if (managePending && !next) return;
          setRejectConfirmOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업무를 반려할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              상태가 <strong>할 일</strong> 로 돌아가고 담당자가 해제됩니다. 작성자가 업무를
              재배정할 때까지 멈춤 상태로 남아 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={managePending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // ⚠️ AlertDialogAction 은 기본적으로 클릭 즉시 창을 닫는다 — 그 전에
                //    managePending 도 아직 false 라 `onOpenChange` 가드가 작동하지 않는다.
                //    `preventDefault` 로 기본 닫기를 막고, 성공 응답이 돌아올 때
                //    `setRejectConfirmOpen(false)` 로 닫는다 (CodeRabbit).
                e.preventDefault();
                handleConfirmReject();
              }}
              disabled={managePending}
              aria-busy={managePending}
            >
              {managePending ? "반려 중…" : "반려"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(next) => {
          if (managePending && !next) return;
          setDeleteConfirmOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업무를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없어요. 변경 이력과 첨부 파일도 함께 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={managePending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={managePending}
              aria-busy={managePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {managePending ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatHistoryTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}
