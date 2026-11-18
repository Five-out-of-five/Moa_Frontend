"use client";

import { Button } from "@/components/ui/button";

export default function IdeaBoardError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-3 p-4">
      <p role="alert" className="text-destructive text-sm">아이디어 보드를 불러오지 못했어요.</p>
      <Button variant="outline" onClick={reset}>다시 시도</Button>
    </div>
  );
}
