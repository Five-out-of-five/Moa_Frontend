"use client";

import { Button } from "@/components/ui/button";

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-xl font-semibold">계정 설정을 불러오지 못했습니다.</h1>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
