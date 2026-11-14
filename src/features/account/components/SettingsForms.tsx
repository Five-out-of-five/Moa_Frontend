"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGlobalNotificationPreferencesAction } from "@/features/notification/actions";
import {
  NOTIFICATION_GROUP_LABEL,
  NOTIFICATION_GROUP_ORDER,
} from "@/features/notification/lib/category-for-kind";
import type { NotificationPreferences } from "@/features/notification/lib/preferences";

import { updateAccountNameAction } from "../actions";
import { INITIAL_SETTINGS_RESULT, type SettingsResult } from "../settings-types";

export function useSettingsFeedback(result: SettingsResult) {
  useEffect(() => {
    if (!result.message) return;
    if (result.success) toast.success(result.message);
    else toast.error(result.message);
  }, [result]);
}

export function SettingsSubmit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <Button disabled={pending}>{pending ? "처리 중…" : children}</Button>;
}

export function AccountNameForm({ name }: { name: string }) {
  const [draftName, setDraftName] = useState(name);
  const [result, action, pending] = useActionState(
    updateAccountNameAction,
    INITIAL_SETTINGS_RESULT,
  );
  useSettingsFeedback(result);

  return (
    <form action={action} className="space-y-3">
      <Label htmlFor="account-name">이름</Label>
      <Input
        id="account-name"
        name="name"
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        required
        minLength={2}
        maxLength={20}
        readOnly={pending}
        aria-invalid={Boolean(result.nameError)}
        aria-describedby={result.nameError ? "account-name-error" : undefined}
      />
      {result.nameError && (
        <p id="account-name-error" className="text-destructive text-sm" role="alert">
          {result.nameError}
        </p>
      )}
      <div className="flex justify-end">
        <SettingsSubmit>변경 사항 저장</SettingsSubmit>
      </div>
    </form>
  );
}

export function NotificationSettingsForm({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const [draft, setDraft] = useState(preferences);
  const [result, action, pending] = useActionState(
    updateGlobalNotificationPreferencesAction,
    INITIAL_SETTINGS_RESULT,
  );
  useSettingsFeedback(result);

  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={pending} className="divide-border divide-y">
        <legend className="sr-only">그룹별 알림 수신 여부</legend>
        {NOTIFICATION_GROUP_ORDER.map((group) => (
          <label key={group} className="flex items-center justify-between gap-4 py-4">
            <span className="text-sm font-medium">
              {group === "SYSTEM" ? "관리자·시스템" : NOTIFICATION_GROUP_LABEL[group]}
              {group === "SYSTEM" && (
                <span className="text-muted-foreground mt-1 block text-xs">
                  서비스 공지와 계정 관련 안내는 항상 수신합니다.
                </span>
              )}
            </span>
            <input
              type="checkbox"
              role="switch"
              name={group}
              checked={draft[group]}
              onChange={(event) => setDraft({ ...draft, [group]: event.target.checked })}
              disabled={group === "SYSTEM"}
              className="border-border bg-muted checked:bg-primary focus-visible:ring-ring after:bg-background relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:transition-transform after:content-[''] checked:after:translate-x-4 focus-visible:ring-2 disabled:cursor-default disabled:opacity-65"
            />
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end">
        <SettingsSubmit>알림 설정 저장</SettingsSubmit>
      </div>
    </form>
  );
}
