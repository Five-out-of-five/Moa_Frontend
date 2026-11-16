"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  MemberRef,
  TaskDetail,
  TaskPriority,
  TaskStatus,
} from "@/types/db";

import { updateTaskAction } from "../actions";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from "../lib/labels";

interface Props {
  roomId: number;
  /** 수정 대상 — Dialog 가 닫혀 있어도 다음 열림에 대비해 받아 둔다. */
  task: TaskDetail;
  /** 담당자 셀렉터에 들어갈 활성 방 멤버 목록. */
  members: readonly MemberRef[];
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 수정 성공 시 최신 상세를 상위로 올려 보낸다. */
  onUpdated(task: TaskDetail): void;
}

type FieldErrors = Partial<Record<string, string>>;

const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH"];
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const UNASSIGNED_VALUE = "__unassigned__";

/**
 * 업무 수정 다이얼로그 — 생성 Dialog 의 축소판으로, 상세 Sheet 의 "수정" 메뉴에서 호출된다.
 *
 * ⚠️ 수정 범위: 제목 · 설명 · 상태 · 담당자 · 우선순위 · 마감일. 명세상 `PATCH /tasks/{id}`
 *    하나로 묶여 있고 담당자 변경 전용 엔드포인트가 없어, 담당자도 이 Dialog 로 바꾼다.
 * ⚠️ 상태를 다른 컬럼으로 바꾸면 서버가 **새 컬럼 맨 아래** 로 카드 위치를 이동시킨다 — 위치
 *    조정은 보드 DnD/상태 버튼의 몫이고 여기선 내용 교체가 주제.
 * ⚠️ `version` 으로 낙관적 잠금. 409 (conflict) 를 받으면 새로고침 안내로 떨어뜨림.
 */
export function TaskEditDialog({
  roomId,
  task,
  members,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assigneeAccountId, setAssigneeAccountId] = useState<number | null>(
    task.assignee?.accountId ?? null,
  );
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const titleInputId = useId();
  const descInputId = useId();
  const statusInputId = useId();
  const assigneeInputId = useId();
  const priorityInputId = useId();
  const dueInputId = useId();

  // Dialog 를 다시 열 때마다 현재 서버값으로 초기화 — 다른 업무로 전환되거나 취소 후 재오픈에
  // 이전 입력이 남지 않도록.
  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeAccountId(task.assignee?.accountId ?? null);
      setDueDate(task.dueDate ?? "");
      setError(null);
      setFieldErrors({});
    }
  }, [open, task]);

  // 제출 중 X·ESC·overlay 로 닫히면 reset effect 가 입력을 지우고 성공 콜백이 꼬이므로
  // pending 중엔 close 요청을 무시한다 (TaskCreateDialog 와 동일 가드).
  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    onOpenChange(next);
  };

  const canSubmit = !pending && title.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      let result;
      try {
        result = await updateTaskAction({
          roomId,
          taskId: task.taskId,
          version: task.version,
          title: title.trim(),
          description,
          status,
          priority,
          assigneeAccountId,
          dueDate: dueDate.length > 0 ? dueDate : null,
        });
      } catch (e) {
        console.error("TaskEditDialog updateTaskAction rejected:", e);
        setError(
          "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
        );
        return;
      }
      if (result.kind === "ok") {
        onUpdated(result.task);
        onOpenChange(false);
        return;
      }
      if (result.kind === "conflict") {
        setError(result.message);
        return;
      }
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>업무 수정</DialogTitle>
          <DialogDescription>
            제목 · 상태 · 담당자 · 마감일을 한 번에 바꿉니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={titleInputId}>제목</Label>
            <Input
              id={titleInputId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="업무 제목을 입력하세요."
              maxLength={MAX_TITLE_LENGTH}
              aria-invalid={fieldErrors.title ? true : undefined}
              aria-describedby={
                fieldErrors.title ? `${titleInputId}-error` : undefined
              }
            />
            {fieldErrors.title && (
              <FieldError id={`${titleInputId}-error`}>
                {fieldErrors.title}
              </FieldError>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={descInputId}>설명</Label>
            <Textarea
              id={descInputId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="무슨 기능이고 어떻게 해야할지 적어주세요."
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={statusInputId}>상태</Label>
              <SelectNative
                id={statusInputId}
                value={status}
                onChange={(v) => setStatus(v as TaskStatus)}
              >
                {TASK_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={assigneeInputId}>담당자</Label>
              <SelectNative
                id={assigneeInputId}
                value={
                  assigneeAccountId === null
                    ? UNASSIGNED_VALUE
                    : String(assigneeAccountId)
                }
                onChange={(v) =>
                  setAssigneeAccountId(
                    v === UNASSIGNED_VALUE ? null : Number(v),
                  )
                }
                aria-invalid={
                  fieldErrors.assigneeAccountId ? true : undefined
                }
                aria-describedby={
                  fieldErrors.assigneeAccountId
                    ? `${assigneeInputId}-error`
                    : undefined
                }
              >
                <option value={UNASSIGNED_VALUE}>미담당</option>
                {members.map((m) => (
                  <option key={m.accountId} value={m.accountId}>
                    {m.displayName}
                  </option>
                ))}
              </SelectNative>
              {fieldErrors.assigneeAccountId && (
                <FieldError id={`${assigneeInputId}-error`}>
                  {fieldErrors.assigneeAccountId}
                </FieldError>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={priorityInputId}>우선순위</Label>
              <SelectNative
                id={priorityInputId}
                value={priority}
                onChange={(v) => setPriority(v as TaskPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={dueInputId}>마감일</Label>
              <Input
                id={dueInputId}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-invalid={fieldErrors.dueDate ? true : undefined}
                aria-describedby={
                  fieldErrors.dueDate ? `${dueInputId}-error` : undefined
                }
              />
              {fieldErrors.dueDate && (
                <FieldError id={`${dueInputId}-error`}>
                  {fieldErrors.dueDate}
                </FieldError>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={pending}
          >
            {pending ? "저장하는 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} className="text-destructive text-xs">
      {children}
    </p>
  );
}

/**
 * 네이티브 `<select>` 래퍼 — shadcn Select 가 아직 준비돼 있지 않아 네이티브로 그리되 디자인
 * 토큰에 맞춘다. `TaskCreateDialog` 의 같은 이름 로컬 함수와 동일한 shape 로, 추후 shadcn
 * Select 로 교체할 때 두 Dialog 를 함께 바꾼다.
 */
function SelectNative({
  id,
  value,
  onChange,
  children,
  disabled,
  ...rest
}: {
  id?: string;
  value: string;
  onChange(value: string): void;
  children: React.ReactNode;
  disabled?: boolean;
} & React.AriaAttributes) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="border-border bg-background focus:ring-ring h-9 rounded-[var(--radius-control)] border px-2 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
      {...rest}
    >
      {children}
    </select>
  );
}
