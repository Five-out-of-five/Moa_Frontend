"use client";

import { PageError } from "@/components/common/PageError";

export default function IdeaBoardError({ reset }: { reset: () => void }) {
  return <PageError title="아이디어 보드를 불러오지 못했어요" onRetry={reset} />;
}
