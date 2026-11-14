"use client";

import { EyeOff, Plus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

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
import type { VoteDetail, VoteType } from "@/types/db";

import { createVoteAction } from "../actions";

interface Props {
  roomId: number;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 생성 성공 시 신규 상세를 부모에 올려 보낸다 — 상세 Sheet 자동 오픈용. */
  onCreated(vote: VoteDetail): void;
}

type FieldErrors = Partial<Record<string, string>>;

const TYPE_LABELS: Record<VoteType, string> = {
  SINGLE: "단일 선택",
  MULTIPLE: "복수 선택",
  YES_NO: "찬반",
};

const MAX_OPTIONS = 10;
const MAX_TITLE_LENGTH = 120;
const MAX_OPTION_LENGTH = 60;
/** 마감 일시 default — 지금+24시간. 사용자가 그대로 두어도 "내일 이맘때" 로 열린다. */
const DEFAULT_DEADLINE_OFFSET_MS = 24 * 60 * 60 * 1000;

/**
 * 새 투표 생성 다이얼로그 — Figma Make `투표 생성` 디자인 그대로.
 *
 * ⚠️ 입력 UI 는 유형에 따라 분기:
 *   - SINGLE / MULTIPLE : 선택지 입력 2 ~ {@link MAX_OPTIONS} 개
 *   - MULTIPLE : "최대 선택 수" 입력 추가 (1 ~ 선택지 수)
 *   - YES_NO : 선택지는 "찬성/반대" 로 서버가 자동 — 입력 숨김
 * ⚠️ 마감 일시는 `<input type="datetime-local">` 로 입력받고, 제출 직전
 *    `toISOString()` 으로 변환해 서버에는 ISO (UTC) 로 보낸다.
 * ⚠️ 사용자가 Dialog 를 닫으면 로컬 입력도 초기화 — 다음에 열 때 깨끗한 상태로.
 */
export function VoteCreateDialog({
  roomId,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [voteType, setVoteType] = useState<VoteType>("SINGLE");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [maxSelectCount, setMaxSelectCount] = useState(2);
  const [deadlineAt, setDeadlineAt] = useState(() => defaultDeadlineLocal());
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const titleInputId = useId();
  const deadlineInputId = useId();
  const maxSelectInputId = useId();
  const typeGroupId = useId();
  // 선택지 "추가" 직후 새로 만든 input 으로 포커스 보내기 — 키보드 사용자가
  // 마우스 없이 바로 타이핑할 수 있게.
  const optionRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusNextOption = useRef(false);

  const resetState = () => {
    setTitle("");
    setVoteType("SINGLE");
    setOptions(["", ""]);
    setMaxSelectCount(2);
    setDeadlineAt(defaultDeadlineLocal());
    setAnonymous(false);
    setError(null);
    setFieldErrors({});
  };

  // Dialog 를 닫으면 상태 초기화. 열 때는 기존 입력을 유지하지 않도록 매번 리셋.
  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  useEffect(() => {
    if (!focusNextOption.current) return;
    focusNextOption.current = false;
    const lastIdx = options.length - 1;
    optionRefs.current[lastIdx]?.focus();
  }, [options.length]);

  const isYesNo = voteType === "YES_NO";
  const isMultiple = voteType === "MULTIPLE";

  const trimmedOptionsCount = useMemo(
    () => options.filter((o) => o.trim().length > 0).length,
    [options],
  );

  const canSubmit =
    !pending &&
    title.trim().length > 0 &&
    deadlineAt.length > 0 &&
    (isYesNo || trimmedOptionsCount >= 2) &&
    (!isMultiple || (maxSelectCount >= 1 && maxSelectCount <= trimmedOptionsCount));

  const changeType = (next: VoteType) => {
    setVoteType(next);
    setFieldErrors((prev) => ({ ...prev, voteType: undefined, options: undefined, maxSelectCount: undefined }));
    if (next === "MULTIPLE") {
      // MULTIPLE 로 전환 시 maxSelectCount 를 현재 유효 선택지 수 안으로 당긴다.
      setMaxSelectCount((prev) =>
        Math.min(Math.max(prev, 1), Math.max(trimmedOptionsCount, 2)),
      );
    }
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    focusNextOption.current = true;
    setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
    setMaxSelectCount((prev) => Math.min(prev, options.length - 1));
  };

  const updateOption = (idx: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    setFieldErrors({});
    const trimmedOptions = isYesNo
      ? [] // 서버가 "찬성/반대" 로 채움 — 전송값은 무시된다
      : options.map((o) => o.trim()).filter((o) => o.length > 0);
    const deadlineIso = localInputToIso(deadlineAt);
    if (!deadlineIso) {
      setFieldErrors({ deadlineAt: "마감 일시가 올바르지 않습니다." });
      return;
    }
    startTransition(async () => {
      let result;
      try {
        result = await createVoteAction({
          roomId,
          title: title.trim(),
          voteType,
          options: trimmedOptions,
          maxSelectCount: isMultiple ? maxSelectCount : 1,
          deadlineAt: deadlineIso,
          anonymous,
        });
      } catch (e) {
        // Server Action 호출 자체 reject (네트워크 등) — 상위 error boundary 로 나가지
        // 않도록 여기서 받는다 (참여 액션과 같은 패턴).
        console.error("VoteCreateDialog createVoteAction rejected:", e);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>새 투표 만들기</DialogTitle>
          <DialogDescription>
            팀이 쉽게 결정할 수 있도록 질문을 명확하게 작성하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 투표 제목 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={titleInputId}>투표 제목</Label>
            <Input
              id={titleInputId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="궁금한 내용을 질문으로 작성하세요."
              maxLength={MAX_TITLE_LENGTH}
              aria-invalid={fieldErrors.title ? true : undefined}
              aria-describedby={
                fieldErrors.title ? `${titleInputId}-error` : undefined
              }
            />
            {fieldErrors.title && (
              <FieldError id={`${titleInputId}-error`}>{fieldErrors.title}</FieldError>
            )}
          </div>

          {/* 투표 유형 */}
          <div className="flex flex-col gap-1.5">
            <span id={typeGroupId} className="text-sm font-medium">
              투표 유형
            </span>
            <div
              role="radiogroup"
              aria-labelledby={typeGroupId}
              className="border-border bg-background flex items-center gap-1 rounded-[var(--radius-control)] border p-1"
            >
              {(Object.keys(TYPE_LABELS) as VoteType[]).map((t) => {
                const active = t === voteType;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => changeType(t)}
                    className={cn(
                      "flex-1 rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-brand text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 선택지 — YES_NO 는 숨김 */}
          {!isYesNo && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>선택지</Label>
                <button
                  type="button"
                  onClick={addOption}
                  disabled={options.length >= MAX_OPTIONS}
                  className="text-brand inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40"
                >
                  <Plus className="size-3.5" />선택지 추가
                </button>
              </div>
              <ul className="flex flex-col gap-2">
                {options.map((value, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="bg-muted text-muted-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                    >
                      {idx + 1}
                    </span>
                    <Input
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      value={value}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      placeholder={`선택지 ${idx + 1}`}
                      maxLength={MAX_OPTION_LENGTH}
                      aria-label={`선택지 ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      disabled={options.length <= 2}
                      aria-label={`선택지 ${idx + 1} 삭제`}
                      className="text-muted-foreground hover:text-destructive inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] disabled:opacity-30 disabled:hover:text-muted-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {fieldErrors.options && <FieldError>{fieldErrors.options}</FieldError>}
            </div>
          )}

          {/* 최대 선택 수 — MULTIPLE 전용 */}
          {isMultiple && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={maxSelectInputId}>최대 선택 수</Label>
              <Input
                id={maxSelectInputId}
                type="number"
                min={1}
                max={Math.max(trimmedOptionsCount, 2)}
                value={maxSelectCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setMaxSelectCount(Number.isFinite(n) ? n : 1);
                }}
                aria-invalid={fieldErrors.maxSelectCount ? true : undefined}
                className="max-w-[120px]"
              />
              {fieldErrors.maxSelectCount && (
                <FieldError>{fieldErrors.maxSelectCount}</FieldError>
              )}
            </div>
          )}

          {/* 마감 일시 + 익명 */}
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
                <FieldError>{fieldErrors.deadlineAt}</FieldError>
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
            {pending ? "만드는 중…" : "투표 만들기"}
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
 * `<input type="datetime-local">` 는 "YYYY-MM-DDTHH:mm" 형식을 요구한다.
 * `Date.toISOString()` 은 UTC 를 돌려주므로 로컬 시간대 기준으로 포맷을 직접 만든다.
 */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDeadlineLocal(): string {
  return toLocalInput(new Date(Date.now() + DEFAULT_DEADLINE_OFFSET_MS));
}

/**
 * datetime-local 입력값 ("2026-11-14T12:29") → ISO UTC ("2026-11-14T03:29:00.000Z").
 * 서버는 명세상 UTC ISO 를 받는다.
 */
function localInputToIso(local: string): string | null {
  if (!local) return null;
  const ms = Date.parse(local);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}
