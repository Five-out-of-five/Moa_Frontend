"use client";

import { PageError } from "@/components/common/PageError";

export default function MediationError({ reset }: { reset: () => void }) {
  return <PageError title="중재 정보를 불러오지 못했어요" onRetry={reset} />;
}
