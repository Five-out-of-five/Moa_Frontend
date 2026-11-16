"use client";

import { EyeOff } from "lucide-react";
import { useEffect, useId, useMemo, useState, useTransition } from "react";

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
import { cn } from "@/lib/utils";
import type { VoteDetail } from "@/types/db";

import { createRevoteAction } from "../actions";

interface Props {
  roomId: number;
  /** 재투표의 **부모** — CLOSED 상태여야 한다. 선택지·유형을 그대로 복제한다. */
  parent: VoteDetail;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 재투표 성공 시 신규 상세를 상위로 올려 보낸다 — 상세 Sheet 자동 오픈용. */
  onCreated(vote: VoteDetail): void;
}

type FieldErrors = Partial<Record<string, string>>;

const MAX_TITLE_LENGTH = 120;
/** 재투표 기본 마감: 지금으로부터 7일 뒤 23:59 (로컬 시각). */
const DEFAULT_DAYS_AHEAD = 7;

/**
 * 재투표 생성 다이얼로그 — CLOSED 투표 상세 Sheet 의 "다시 투표 열기" 에서 호출된다.
 *
 * ⚠️ 유형(단일/복수/찬반) · 선택지 · 최대 선택 수는 부모에서 자동 복제 — 사용자가 조정할 수
 *    있는 건 **제목 · 마감 · 익명** 셋이다. "같은 조건으로 한 번 더" 가 재투표의 의도라
 *    선택지는 읽기 전용으로 노출만 한다.
 * ⚠️ 제목 기본값은 `다시: <부모 제목>`. 사용자가 다듬어 저장할 수 있도록 미리 채워 둔다.
 * ⚠️ 투표 수정/생성 Dialog 와 같은 패턴: `kind` 분기, pending 중 close 가드, Server Action
 *    reject 는 try/catch 로 받아 상위 error boundary 로 올리지 않는다.
 */
export function VoteRevoteDialog({
  roomId,
  parent,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const defaultTitle = useMemo(() => `다시: ${parent.title}`, [parent.title]);
  const defaultDeadline = useMemo(() => computeDefaultDeadline(), []);

  const [title, setTitle] = useState(defaultTitle);
  const [deadlineAt, setDeadlineAt] = useState(defaultDeadline);
  const [anonymous, setAnonymous] = useState(parent.anonymous);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const titleInputId = useId();
  const deadlineInputId = useId();

  // Dialog 를 다시 열 때마다 기본값으로 초기화 — 취소 후 재오픈이나 다른 부모로 전환에
  // 이전 입력이 남지 않도록.
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDeadlineAt(computeDefaultDeadline());
      setAnonymous(parent.anonymous);
      setError(null);
      setFieldErrors({});
    }
  }, [open, defaultTitle, parent.anonymous]);

  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    onOpenChange(next);
  };

  const canSubmit =
    !pending && title.trim().length > 0 && deadlineAt.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      let isoDeadline: string;
      try {
        isoDeadline = new Date(deadlineAt).toISOString();
      } catch {
        setFieldErrors({ deadlineAt: "마감 일시가 올바르지 않습니다." });
        setError("마감 일시가 올바르지 않습니다.");
        return;
      }
      let result;
      try {
        result = await createRevoteAction({
          roomId,
          parentVoteId: parent.voteId,
          title: title.trim(),
          deadlineAt: isoDeadline,
          anonymous,
        });
      } catch (e) {
        console.error("VoteRevoteDialog createRevoteAction rejected:", e);
        setError(
          "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
        );
        return;
      }
      if (result.kind === "ok") {
        onCreated(result.vote);
        onOpenChange(false);
        return;
      }
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    });
  };

  const typeLabel =
    parent.voteType === "SINGLE"
      ? "단일 선택"
      : parent.voteType === "MULTIPLE"
        ? `복수 선택 (최대 ${parent.maxSelectCount}개)`
        : "찬반";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>다시 투표 열기</DialogTitle>
          <DialogDescription>
            선택지와 유형은 원본 투표에서 그대로 복제됩니다. 제목과 마감만 조정하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={titleInputId}>제목</Label>
            <Input
              id={titleInputId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
            <Label htmlFor={deadlineInputId}>마감 일시</Label>
            <Input
              id={deadlineInputId}
              type="datetime-local"
              value={deadlineAt}
              onChange={(e) => setDeadlineAt(e.target.value)}
              aria-invalid={fieldErrors.deadlineAt ? true : undefined}
              aria-describedby={
                fieldErrors.deadlineAt ? `${deadlineInputId}-error` : undefined
              }
            />
            {fieldErrors.deadlineAt && (
              <FieldError id={`${deadlineInputId}-error`}>
                {fieldErrors.deadlineAt}
              </FieldError>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="border-border rounded"
            />
            <span className="inline-flex items-center gap-1">
              <EyeOff className="size-3.5" />
              익명 투표로 진행
            </span>
          </label>

          {/* 선택지 · 유형 — 읽기 전용 확인 영역. */}
          <div className="border-border-soft bg-background flex flex-col gap-2 rounded-[var(--radius-control)] border px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium">
              유형 · {typeLabel}
            </p>
            <ul className="flex flex-col gap-1">
              {parent.options.map((o) => (
                <li
                  key={o.optionId}
                  className={cn(
                    "text-foreground text-xs",
                    "before:text-muted-foreground before:mr-1.5 before:content-['·']",
                  )}
                >
                  {o.content}
                </li>
              ))}
            </ul>
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
            {pending ? "여는 중…" : "다시 열기"}
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
 * 지금 기준 7일 뒤 23:59 (로컬 시각) 을 `datetime-local` 입력 포맷으로 반환.
 * `yyyy-MM-ddTHH:mm` 꼴이며, 사용자가 자유롭게 조정할 수 있다.
 */
function computeDefaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_DAYS_AHEAD);
  d.setHours(23, 59, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
