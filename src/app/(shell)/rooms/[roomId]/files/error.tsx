"use client";

import { PageError } from "@/components/common/PageError";

export default function RoomFilesError({ reset }: { reset: () => void }) {
  return <PageError title="파일 목록을 불러오지 못했어요" onRetry={reset} />;
}
