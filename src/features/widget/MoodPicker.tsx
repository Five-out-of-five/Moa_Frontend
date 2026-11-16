"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { submitMoodAction } from "@/features/mood/actions";
import type { MoodLevel } from "@/types/db";

export function MoodPicker({
  roomId,
  selected,
  options,
}: {
  roomId: number;
  selected?: MoodLevel;
  options: readonly { mood: MoodLevel; label: string; score: number }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="border-border space-y-1 border-t pt-1.5">
      <p className="text-muted-foreground text-xs">오늘 기분은 어떤가요?</p>
      <div role="group" aria-label="오늘 기분 선택" className="flex gap-1">
        {options.map(({ mood, label, score }) => (
          <button
            key={mood}
            type="button"
            aria-label={label}
            aria-pressed={mood === selected}
            title={label}
            disabled={pending}
            className="border-border bg-muted hover:bg-secondary focus-visible:ring-ring aria-pressed:border-primary aria-pressed:text-primary h-6 min-w-0 max-w-6 flex-1 rounded-full border text-xs focus-visible:ring-2 disabled:opacity-60"
            onClick={() => startTransition(async () => {
              try {
                await submitMoodAction({ roomId, mood });
                toast.success("오늘의 기분을 저장했어요.");
              } catch {
                toast.error("기분을 저장하지 못했어요. 다시 시도해 주세요.");
              }
            })}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}
