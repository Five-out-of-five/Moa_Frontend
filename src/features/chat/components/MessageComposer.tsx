"use client";

import { AtSign, Paperclip, Send, Smile } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToneReview } from "@/features/tone/ToneReview";
import { cn } from "@/lib/utils";

interface Props {
  /** placeholder — 채널은 "제품-논의 채널에 메시지 보내기", DM 은 "이주은 님에게 메시지 보내기" 류. */
  placeholder: string;
  /** 비활성 안내 — 읽기 전용 채널이거나 상대가 탈퇴한 DM 등. 메시지는 있지만 입력은 막을 때. */
  disabledReason?: string;
  /** 전송 핸들러. 로컬 낙관적 추가는 상위가 책임진다. */
  onSend(content: string): void;
  toneTarget?: { kind: "CHAT"; roomId: number; channelId: number };
}

const MAX_LENGTH = 2000;

/**
 * 메시지 입력창 — 멀티라인 textarea + 전송 / 첨부 / 멘션 / 이모지 아이콘.
 *
 * ⚠️ 전송 규칙 (Figma Make):
 *   - **Enter** → 전송 (단, IME 조합 중이면 무시 — 한글 입력 끝맺음까지 "Enter" 가 두 번 들어옴)
 *   - **Shift+Enter** → 줄바꿈
 *   - 공백만 있는 메시지는 전송 금지
 * ⚠️ 첨부·이모지·멘션 아이콘은 **자리만** — 파일 업로드와 리치 입력은 BE 명세 뒤 후속 PR.
 */
export function MessageComposer({ placeholder, disabledReason, onSend, toneTarget }: Props) {
  const [value, setValue] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const disabled = Boolean(disabledReason);
  const canSend = !disabled && value.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    // 포커스 유지 — 연속 전송 UX.
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return; // Shift+Enter 는 줄바꿈 유지
    // 한글 IME 조합 중엔 Enter 가 조합 완료 역할이라 전송하지 않는다 (CodeRabbit 류 리스크).
    if (isComposing || e.nativeEvent.isComposing) return;
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="border-border bg-surface mx-auto w-full max-w-[720px] rounded-[var(--radius-card)] border px-3 pb-2 pt-2 shadow-sm">
      <div className="flex items-center justify-between pb-1">
        <div className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
          <AtSign aria-hidden="true" className="size-3.5" />
          멘션하려면 @ 를 입력하세요
        </div>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={disabledReason ?? placeholder}
        disabled={disabled}
        rows={2}
        aria-label="메시지 입력"
        className={cn(
          // ⚠️ 공용 Textarea 에 `field-sizing-content` 가 걸려 있어 `rows={2}` 는 상한이
          //    아니다. 100줄 붙여넣기 같은 입력이 들어오면 textarea 가 화면 높이를 넘어
          //    메시지 목록을 삼키므로 `max-h` 와 세로 스크롤로 상한을 건다 (CodeRabbit).
          "min-h-[2.75rem] max-h-32 resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0",
          disabled && "cursor-not-allowed",
        )}
      />
      <div className="mt-1 flex items-center justify-between">
        <div className="text-muted-foreground inline-flex items-center gap-1">
          <IconButton label="파일 첨부" disabled>
            <Paperclip className="size-4" />
          </IconButton>
          <IconButton label="이모지" disabled>
            <Smile className="size-4" />
          </IconButton>
          {toneTarget && <ToneReview target={toneTarget} value={value} onApply={setValue} maxLength={MAX_LENGTH} disabled={disabled} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden text-[11px] sm:inline">
            {disabled
              ? disabledReason
              : "Enter 로 전송 · Shift+Enter 로 줄바꿈"}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="메시지 전송"
            className="h-8"
          >
            <Send className="size-3.5" />
            보내기
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      title={disabled ? `${label} — 후속 작업 범위` : label}
      className="text-muted-foreground hover:bg-muted hover:text-foreground disabled:hover:bg-transparent inline-flex size-7 items-center justify-center rounded-[var(--radius-control)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
