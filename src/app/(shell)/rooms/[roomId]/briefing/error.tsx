"use client";

import { PageError } from "@/components/common/PageError";

export default function BriefingError({ reset }: { reset: () => void }) {
  return <PageError title="캐치업 브리핑을 불러오지 못했어요" onRetry={reset} />;
}
