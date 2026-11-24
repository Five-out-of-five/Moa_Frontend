"use client";

import { PageError } from "@/components/common/PageError";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageError title="화면을 불러오지 못했어요" onRetry={reset} digest={error.digest} fullPage />
  );
}
