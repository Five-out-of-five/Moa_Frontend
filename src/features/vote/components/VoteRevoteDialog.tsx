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
const TITLE_PREFIX = "재투표: ";
/** 재투표 기본 마감: 지금으로부터 7일 뒤 23:59 (KST 기준). */
const DEFAULT_DAYS_AHEAD = 7;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 재투표 생성 다이얼로그 — CLOSED 투표 상세 Sheet 의 "재투표" 버튼에서 호출된다.
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
  // ⚠️ 접두사 길이를 포함해 `MAX_TITLE_LENGTH` 안에 맞춘다 — 부모 제목이 길면 잘라 둔다.
  //    그렇지 않으면 사용자가 기본값 그대로 제출했을 때 zod 가 거절한다 (CodeRabbit).
  const defaultTitle = useMemo(() => {
    const available = MAX_TITLE_LENGTH - TITLE_PREFIX.length;
    return `${TITLE_PREFIX}${parent.title.slice(0, available)}`;
  }, [parent.title]);
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
          <DialogTitle>재투표</DialogTitle>
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
            {pending ? "재투표 생성 중…" : "재투표"}
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
 * **KST 기준 7일 뒤 23:59** 를 사용자 로컬 `datetime-local` 포맷으로 반환.
 *
 * ⚠️ `setDate` / `setHours` 는 실행 환경의 로컬 시간을 쓰므로 UTC 로 설정된 브라우저에서는
 *    7일 뒤 23:59Z 가 되어 요구값(23:59 KST) 보다 9시간 늦게 전송된다 (CodeRabbit). KST 를
 *    기준으로 "다음 7일 뒤의 하루 끝" 시점을 먼저 UTC ms 로 잡고, 사용자 로컬 시간대로
 *    변환해 datetime-local 에 넣어야 입력창에 노출되는 시각이 실제 KST 23:59 와 일치한다.
 */
function computeDefaultDeadline(): string {
  const nowKstMs = Date.now() + KST_OFFSET_MS;
  const kstNow = new Date(nowKstMs);
  // KST 달력 상 "7일 뒤" 00:00 을 만들고 23:59 로 세팅 (UTC Date 로 다룬다).
  const kstTarget = new Date(
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate() + DEFAULT_DAYS_AHEAD,
      23,
      59,
    ),
  );
  // 이 시점의 **실제 UTC ms** 는 위 계산에서 KST 시각을 UTC Date 로 다뤘으므로 KST-9h.
  const actualUtcMs = kstTarget.getTime() - KST_OFFSET_MS;
  const localAtTarget = new Date(actualUtcMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${localAtTarget.getFullYear()}-${pad(localAtTarget.getMonth() + 1)}-${pad(localAtTarget.getDate())}` +
    `T${pad(localAtTarget.getHours())}:${pad(localAtTarget.getMinutes())}`
  );
}
