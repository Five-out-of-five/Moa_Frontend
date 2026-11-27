"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

export function RoomMemberDmForm({ action }: { action: () => Promise<{ error: string }> }) {
  const [result, submit, pending] = useActionState<{ error: string } | null, FormData>(action, null);

  return (
    <form action={submit} className="space-y-2">
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "대화 여는 중…" : "1:1 대화"}
      </Button>
      {!pending && result && <p role="alert" className="text-destructive text-sm">{result.error}</p>}
    </form>
  );
}
