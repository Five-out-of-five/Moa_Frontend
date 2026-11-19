"use client";

import { Button } from "@/components/ui/button";

export default function BriefingError({ reset }: { reset: () => void }) {
  return <div className="space-y-2 p-4"><p role="alert" className="text-destructive text-sm">캐치업 브리핑을 불러오지 못했어요.</p><Button variant="outline" onClick={reset}>다시 시도</Button></div>;
}
