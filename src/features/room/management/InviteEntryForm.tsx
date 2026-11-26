"use client";

import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { getInviteReturnPath } from "./invite-path";

export function InviteEntryForm({ invitePath = "" }: { invitePath?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(invitePath);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const path = getInviteReturnPath(value, window.location.origin);
    if (!path) {
      setError(true);
      return;
    }
    setError(false);
    if (path !== invitePath) startTransition(() => router.push(path));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" aria-busy={pending}>
      <div className="bg-card border-border focus-within:ring-ring/60 flex items-center gap-2 rounded-md border px-2 focus-within:ring-2">
        <Link2 aria-hidden="true" className="text-muted-foreground ml-1 size-4 shrink-0" />
        <Input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(false);
          }}
          aria-label="초대 링크"
          placeholder="초대 링크를 붙여 넣으세요"
          aria-invalid={error}
          aria-describedby={error ? "invite-entry-error" : undefined}
          className="min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <Button variant="secondary" size="sm" disabled={pending || !value.trim()}>
          {pending ? "확인 중…" : "확인"}
        </Button>
      </div>
      {error && (
        <p id="invite-entry-error" role="alert" className="text-destructive text-sm">
          워크스페이스 초대 링크를 확인해 주세요.
        </p>
      )}
    </form>
  );
}
