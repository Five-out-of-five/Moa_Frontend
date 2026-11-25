"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MoodLevel } from "@/types/db";

import { saveMoodFormAction } from "./actions";
import { MOOD_OPTIONS } from "./model";

function SaveButton({ canSave }: { canSave: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending || !canSave}>{pending ? "저장 중…" : "기분 업데이트"}</Button>;
}

export function MoodForm({ roomId, mood, note }: { roomId: number; mood?: MoodLevel; note?: string | null }) {
  const [choice, setChoice] = useState(mood);
  const [comment, setComment] = useState(note ?? "");
  const [previous, setPrevious] = useState({ mood, note });
  const [result, formAction, isSaving] = useActionState(saveMoodFormAction.bind(null, roomId), {});
  if (previous.mood !== mood || previous.note !== note) {
    setPrevious({ mood, note });
    if (choice === previous.mood || isSaving) setChoice(mood);
    if (comment === (previous.note ?? "") || isSaving) setComment(note ?? "");
  }

  useEffect(() => {
    if (result.saved) toast.success("오늘의 기분을 저장했어요.");
    if (result.error) toast.error(result.error);
  }, [result]);

  return (
    <form action={formAction} className="space-y-4">
      <fieldset className="space-y-2" disabled={isSaving}>
        <legend className="sr-only">오늘의 기분</legend>
        {MOOD_OPTIONS.map((option) => (
          <label key={option.mood} className="rounded-control border-border hover:bg-muted has-checked:border-primary/30 has-checked:bg-secondary focus-within:ring-ring flex cursor-pointer items-center gap-3 border px-3 py-2 focus-within:ring-2">
            <input type="radio" name="mood" value={option.mood} checked={choice === option.mood}
              onChange={() => setChoice(option.mood)} className="accent-primary order-last ml-auto size-4" />
            <span aria-hidden="true" className="text-lg">{option.emoji}</span>
            <span className="text-sm font-medium">{option.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <div className="text-muted-foreground flex justify-between text-xs">
          <label htmlFor="mood-note">한 줄 코멘트 (선택)</label><span>{comment.length}/50</span>
        </div>
        <Textarea id="mood-note" name="note" rows={2} maxLength={50} value={comment} readOnly={isSaving}
          onChange={(event) => setComment(event.target.value.replace(/[\r\n]+/g, " "))}
          className="bg-muted/50 resize-none" placeholder="오늘 기분을 한 줄로 남겨보세요." />
      </div>
      {result.error && <p role="alert" className="text-destructive text-sm">{result.error}</p>}
      <SaveButton canSave={Boolean(choice)} />
    </form>
  );
}
