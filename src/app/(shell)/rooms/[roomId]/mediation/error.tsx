"use client";

import { Button } from "@/components/ui/button";

export default function MediationError({ reset }: { reset: () => void }) {
  return <div className="space-y-3 p-4"><p role="alert" className="text-destructive">중재 정보를 불러오지 못했어요.</p><Button variant="outline" onClick={reset}>다시 시도</Button></div>;
}
