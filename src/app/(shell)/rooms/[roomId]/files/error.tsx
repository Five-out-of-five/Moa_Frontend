"use client";

import { Button } from "@/components/ui/button";

export default function RoomFilesError({ reset }: { reset: () => void }) {
  return (
    <div className="bg-card rounded-card space-y-3 border p-5">
      <p role="alert" className="text-destructive">
        파일 목록을 불러오지 못했어요.
      </p>
      <Button variant="outline" onClick={reset}>
        다시 시도
      </Button>
    </div>
  );
}
