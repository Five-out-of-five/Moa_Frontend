"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ToneMode } from "@/types/db";

import { saveToneSettingsAction } from "./actions";
import { TONE_MODES, type ToneSettingsResult } from "./model";

export function ToneSettingsForm({ mode }: { mode: ToneMode }) {
  const [draft, setDraft] = useState(mode);
  const [result, action, pending] = useActionState<ToneSettingsResult, FormData>(
    saveToneSettingsAction,
    {},
  );
  useEffect(() => {
    if (result.saved) toast.success("순화 설정을 저장했어요.");
    else if (result.error) toast.error(result.error);
  }, [result]);
  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="space-y-4">
      <fieldset disabled={pending} className="space-y-2">
        <legend className="mb-3 text-sm font-medium">사용 여부와 순화 방식</legend>
        {TONE_MODES.map(({ value, label, description }) => (
          <label
            key={value}
            className="border-border has-checked:border-primary flex items-start gap-3 rounded-lg border p-3"
          >
            <input
              type="radio"
              name="toneMode"
              value={value}
              defaultChecked={draft === value}
              onChange={() => setDraft(value)}
              className="accent-primary mt-1"
            />
            <span>
              <span className="text-sm font-medium">{label}</span>
              <span className="text-muted-foreground mt-1 block text-xs">{description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {result.error && (
        <p role="alert" className="text-destructive text-sm">
          {result.error}
        </p>
      )}
      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
function SaveButton() {
  const { pending } = useFormStatus();
  return <Button disabled={pending}>{pending ? "저장 중…" : "순화 설정 저장"}</Button>;
}
