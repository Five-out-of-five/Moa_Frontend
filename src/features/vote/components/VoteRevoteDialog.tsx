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
  /** 재투표의 **부모** — CLOSED 상태여야 한다. 선택지·유형·익명을 그대로 복제한다. */
  parent: VoteDetail;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 재투표 성공 시 신규 상세를 상위로 올려 보낸다 — 상세 Sheet 자동 오픈용. */
  onCreated(vote: VoteDetail): void;
}

type FieldErrors = Partial<Record<string, string>>;

/** 재투표 기본 마감: 지금으로부터 7일 뒤 23:59 (KST 기준). */
const DEFAULT_DAYS_AHEAD = 7;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 재투표 생성 다이얼로그 — CLOSED 투표 상세 Sheet 의 "재투표" 버튼에서 호출된다.
 *
 * ⚠️ BE `POST /votes/{id}/revote` 는 `{deadlineAt}` 만 받고 **제목·익명·유형·선택지는
 *    부모에서 자동 복제**한다. 사용자가 조정할 수 있는 건 **마감 일시 하나**뿐이라
 *    기존 제목·익명 입력을 제거 (지난 UI 는 입력해도 BE 가 무시해 혼선이었음).
 * ⚠️ 복제되는 부모 정보는 유형·선택지·익명 설정을 읽기 전용으로 노출해 사용자가 "무엇이
 *    그대로 쓰이는지" 확인할 수 있도록 한다.
 */
export function VoteRevoteDialog({
  roomId,
  parent,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const defaultDeadline = useMemo(() => computeDefaultDeadline(), []);

  const [deadlineAt, setDeadlineAt] = useState(defaultDeadline);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const deadlineInputId = useId();

  // Dialog 를 다시 열 때마다 마감 기본값 재계산.
  useEffect(() => {
    if (open) {
      setDeadlineAt(computeDefaultDeadline());
      setError(null);
      setFieldErrors({});
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    onOpenChange(next);
  };

  const canSubmit = !pending && deadlineAt.length > 0;

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
          deadlineAt: isoDeadline,
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
            제목 · 선택지 · 유형 · 익명 여부는 원본에서 그대로 복제됩니다. 마감만 조정하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
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

          {/* 복제 대상 요약 — 사용자가 "무엇이 그대로 가는지" 볼 수 있도록. */}
          <div className="border-border-soft bg-background flex flex-col gap-2 rounded-[var(--radius-control)] border px-3 py-2.5">
            <p className="text-foreground truncate text-sm font-medium">
              {parent.title}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              유형 · {typeLabel}
              {parent.anonymous && (
                <>
                  <span>·</span>
                  <EyeOff className="size-3" />
                  <span>익명</span>
                </>
              )}
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
