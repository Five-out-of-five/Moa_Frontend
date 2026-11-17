"use client";

import { Button } from "@/components/ui/button";

export default function TeamMoodError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4">
      <p role="alert" className="text-destructive text-sm">팀 상태를 불러오지 못했어요.</p>
      <Button variant="outline" onClick={reset}>다시 시도</Button>
    </div>
  );
}
