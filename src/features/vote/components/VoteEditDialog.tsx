"use client";

import { EyeOff } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { VoteDetail } from "@/types/db";

import { updateVoteAction } from "../actions";

interface Props {
  roomId: number;
  voteId: number;
  /** BE 가 낙관적 잠금을 위해 요구하는 현재 버전. 상세 응답의 `version` 그대로 넘긴다. */
  initialVersion: number;
  initialTitle: string;
  /** 서버 ISO (UTC). datetime-local 입력 초기값으로 변환해 넣는다. */
  initialDeadlineAt: string;
  initialAnonymous: boolean;
  open: boolean;
  onOpenChange(open: boolean): void;
  onUpdated(vote: VoteDetail): void;
}

type FieldErrors = Partial<Record<string, string>>;

const MAX_TITLE_LENGTH = 120;

/**
 * 투표 수정 다이얼로그 — 생성 다이얼로그의 축소판.
 *
 * ⚠️ 이번 PR 수정 범위는 **제목 · 마감 일시 · 익명 여부** 셋. 선택지 / 유형 / 최대 선택 수는
 *    참여가 이미 들어온 투표에서 바뀌면 집계·공정성 문제가 커 범위 외 (BE 명세 확정 뒤).
 * ⚠️ `datetime-local` 입력값은 제출 직전 `toISOString()` 으로 UTC ISO 로 변환.
 */
export function VoteEditDialog({
  roomId,
  voteId,
  initialVersion,
  initialTitle,
  initialDeadlineAt,
  initialAnonymous,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [deadlineAt, setDeadlineAt] = useState(() =>
    isoToLocalInput(initialDeadlineAt),
  );
  const [anonymous, setAnonymous] = useState(initialAnonymous);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const titleInputId = useId();
  const deadlineInputId = useId();

  // Dialog 를 다시 열면 현재 서버값으로 초기화 — 다른 투표 사이를 오갈 때 이전 입력이
  // 남지 않도록.
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDeadlineAt(isoToLocalInput(initialDeadlineAt));
      setAnonymous(initialAnonymous);
      setError(null);
      setFieldErrors({});
    }
  }, [open, initialTitle, initialDeadlineAt, initialAnonymous]);

  const canSubmit = !pending && title.trim().length > 0 && deadlineAt.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const deadlineIso = localInputToIso(deadlineAt);
    if (!deadlineIso) {
      setFieldErrors({ deadlineAt: "마감 일시가 올바르지 않습니다." });
      return;
    }
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      let result;
      try {
        result = await updateVoteAction({
          roomId,
          voteId,
          version: initialVersion,
          title: title.trim(),
          deadlineAt: deadlineIso,
          anonymous,
        });
      } catch (e) {
        console.error("VoteEditDialog updateVoteAction rejected:", e);
        setError(
          "요청을 보내지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
        );
        return;
      }
      if (result.kind === "ok") {
        onUpdated(result.vote);
        onOpenChange(false);
        return;
      }
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>투표 수정</DialogTitle>
          <DialogDescription>
            제목 · 마감 일시 · 익명 여부를 바꿀 수 있어요. 선택지 수정은 지원 예정입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={titleInputId}>투표 제목</Label>
            <Input
              id={titleInputId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
              aria-invalid={fieldErrors.title ? true : undefined}
            />
            {fieldErrors.title && (
              <p className="text-destructive text-xs">{fieldErrors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={deadlineInputId}>마감 일시</Label>
              <Input
                id={deadlineInputId}
                type="datetime-local"
                value={deadlineAt}
                onChange={(e) => setDeadlineAt(e.target.value)}
                min={toLocalInput(new Date())}
                aria-invalid={fieldErrors.deadlineAt ? true : undefined}
              />
              {fieldErrors.deadlineAt && (
                <p className="text-destructive text-xs">{fieldErrors.deadlineAt}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">익명 투표</span>
              <button
                type="button"
                role="switch"
                aria-checked={anonymous}
                onClick={() => setAnonymous((v) => !v)}
                className={cn(
                  "border-border bg-background hover:border-brand flex items-center justify-between rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors",
                  anonymous && "border-brand bg-secondary",
                )}
              >
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <EyeOff className="size-3.5" />
                  {anonymous ? "사용함" : "사용 안함"}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                    anonymous ? "bg-brand" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
                      anonymous ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </span>
              </button>
            </div>
          </div>

          {!initialAnonymous && anonymous && (
            <p className="text-warning text-xs">
              비공개로 전환하면 기존 참여자 목록이 비노출로 바뀝니다.
            </p>
          )}

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
            {pending ? "저장 중…" : "저장하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Date → "YYYY-MM-DDTHH:mm" (datetime-local input 포맷). 로컬 시간대 기준. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 서버 ISO(UTC) → "YYYY-MM-DDTHH:mm" (datetime-local 포맷, 로컬 시간대). */
function isoToLocalInput(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return toLocalInput(new Date(ms));
}

/** datetime-local 입력값 → ISO UTC. */
function localInputToIso(local: string): string | null {
  if (!local) return null;
  const ms = Date.parse(local);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}
