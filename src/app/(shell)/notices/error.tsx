"use client";

import { Button } from "@/components/ui/button";

export default function NoticesError({ reset }: { reset: () => void }) {
  return <div className="bg-card border-border rounded-card mx-auto max-w-4xl space-y-3 border p-5">
    <p role="alert" className="text-destructive text-sm">공지를 불러오지 못했어요.</p>
    <Button variant="outline" onClick={reset}>다시 시도</Button>
  </div>;
}
