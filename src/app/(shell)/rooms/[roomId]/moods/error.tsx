"use client";

import { PageError } from "@/components/common/PageError";

export default function TeamMoodError({ reset }: { reset: () => void }) {
  return <PageError title="팀 상태를 불러오지 못했어요" onRetry={reset} />;
}
