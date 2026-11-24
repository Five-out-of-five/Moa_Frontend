"use client";

import { PageError } from "@/components/common/PageError";

export default function AccountError({ reset }: { reset: () => void }) {
  return <PageError title="계정 설정을 불러오지 못했습니다" onRetry={reset} />;
}
