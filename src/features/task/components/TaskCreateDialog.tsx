"use client";

import { User } from "lucide-react";
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
  Sprint,
  TaskDetail,
  TaskPriority,
  TaskStatus,
} from "@/types/db";

import { createTaskAction } from "../actions";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from "../lib/labels";

interface Props {
  roomId: number;
  /** 담당자 셀렉터에 들어갈 활성 방 멤버 목록. 상위에서 선패치해 주입. */
  members: readonly MemberRef[];
  /** 기본 담당자 (보통 "나"). null 이면 "미담당" 이 기본값. */
  defaultAssigneeAccountId: number | null;
  /**
   * 방의 활성 스프린트. Figma Make 디자인의 스프린트 셀렉터에 노출.
   * null 이면 "활성 스프린트 없음" 비활성 상태로 노출된다.
   * ⚠️ BE 명세 확정 전까지는 **선택이 아니라 표시 전용** — 서버 호출엔 포함하지 않는다.
   */
  activeSprint: Sprint | null;
  /** 생성 다이얼로그 기본 상태 — 칸 별 "+ 추가" 버튼이 생기면 쓸 수 있도록 prop 으로. */
  defaultStatus?: TaskStatus;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 생성 성공 시 신규 상세를 부모에 올려 보낸다 — 상세 Sheet 자동 오픈용. */
  onCreated(task: TaskDetail): void;
}

type FieldErrors = Partial<Record<string, string>>;

const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH"];
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const UNASSIGNED_VALUE = "__unassigned__";

/**
 * 새 업무 생성 다이얼로그 — Figma Make "새 업무 추가" 디자인 그대로.
 *
 * ⚠️ 입력 필드: 제목(필수) · 설명 · 상태 · 담당자 · 우선순위 · 마감일.
 * ⚠️ 스프린트 선택은 **생략** — 명세 확정 전까지 서버가 현재 활성 스프린트에 자동 소속
 *    시킨다 (이슈 #40 범위 외).
 * ⚠️ 담당자는 `<select>` + "미담당" 특수 옵션(`UNASSIGNED_VALUE`) 으로 다룬다. 서버엔
 *    `null` 로 전송.
 * ⚠️ 투표 생성과 같은 패턴: throw 하지 않고 `CreateTaskResult.kind` 로 분기, Server
 *    Action 호출 자체 reject(네트워크 등) 는 try/catch 로 받아 상위 error boundary 로
 *    나가지 않게 함.
 */
export function TaskCreateDialog({
  roomId,
  members,
  defaultAssigneeAccountId,
  activeSprint,
  defaultStatus = "TODO",
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [assigneeAccountId, setAssigneeAccountId] = useState<number | null>(
    defaultAssigneeAccountId,
  );
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const titleInputId = useId();
  const descInputId = useId();
  const statusInputId = useId();
  const assigneeInputId = useId();
  const priorityInputId = useId();
  const dueInputId = useId();
  const sprintInputId = useId();

  const resetState = () => {
    setTitle("");
    setDescription("");
    setStatus(defaultStatus);
    setPriority("NORMAL");
    setAssigneeAccountId(defaultAssigneeAccountId);
    setDueDate("");
    setError(null);
    setFieldErrors({});
  };

  // Dialog 를 닫으면 상태 초기화. 투표 생성 다이얼로그와 같은 UX.
  useEffect(() => {
    if (!open) resetState();
    // resetState 는 매 렌더 재생성되지만 open 전환 시점에만 호출되므로 의도적 ignore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit = !pending && title.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      let result;
      try {
        result = await createTaskAction({
          roomId,
          title: title.trim(),
          description,
          status,
          priority,
          assigneeAccountId,
          dueDate: dueDate.length > 0 ? dueDate : null,
        });
      } catch (e) {
        console.error("TaskCreateDialog createTaskAction rejected:", e);
        setError(
          "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
        );
        return;
      }
      if (result.kind === "ok") {
        onCreated(result.task);
        onOpenChange(false);
        return;
      }
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>새 업무 추가</DialogTitle>
          <DialogDescription>
            담당자와 우선순위를 명확하게 지정하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 제목 */}
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

          {/* 설명 */}
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

          {/* 상태 · 담당자 */}
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
                value={assigneeAccountId === null ? UNASSIGNED_VALUE : String(assigneeAccountId)}
                onChange={(v) =>
                  setAssigneeAccountId(
                    v === UNASSIGNED_VALUE ? null : Number(v),
                  )
                }
                aria-invalid={fieldErrors.assigneeAccountId ? true : undefined}
              >
                <option value={UNASSIGNED_VALUE}>미담당</option>
                {members.map((m) => (
                  <option key={m.accountId} value={m.accountId}>
                    {m.displayName}
                  </option>
                ))}
              </SelectNative>
              {fieldErrors.assigneeAccountId && (
                <FieldError>{fieldErrors.assigneeAccountId}</FieldError>
              )}
            </div>
          </div>

          {/* 우선순위 · 마감일 */}
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
              />
              {fieldErrors.dueDate && (
                <FieldError>{fieldErrors.dueDate}</FieldError>
              )}
            </div>
          </div>

          {/* 스프린트 — Figma Make 디자인의 활성 스프린트 표시 영역.
              ⚠️ BE 명세 확정 전까지는 선택 UI 가 아니라 **표시 전용** (disabled).
                 활성 스프린트가 없으면 "활성 스프린트 없음" 으로 노출. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={sprintInputId}>스프린트</Label>
            <SelectNative
              id={sprintInputId}
              value="active"
              onChange={() => {
                /* readonly */
              }}
              disabled
            >
              <option value="active">
                {activeSprint ? activeSprint.name : "활성 스프린트 없음"}
              </option>
            </SelectNative>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          {/* 안내 문구 — Figma Make 디자인에선 "업무량 기준 담당자 추천" 안내. 추천 로직은
              후속 작업이라 여기선 "담당자는 직접 선택할 수 있어요" 로 축약해 고지만 둔다. */}
          <p className="text-muted-foreground border-border bg-background flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-xs">
            <User aria-hidden="true" className="size-3.5 shrink-0 mt-0.5" />
            <span>
              담당자는 직접 선택할 수 있어요. 생성 뒤 상세에서도 바꿀 수 있습니다.
            </span>
          </p>
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
            {pending ? "추가하는 중…" : "추가하기"}
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
 * 간단한 네이티브 `<select>` 래퍼 — shadcn 레포에 `Select` 가 아직 추가돼 있지 않아
 * 네이티브로 그리되 디자인 토큰에 맞춘다. 화살표는 브라우저 기본 UI.
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
