"use client";

import { PageError } from "@/components/common/PageError";

export default function NoticesError({ reset }: { reset: () => void }) {
  return <PageError title="공지를 불러오지 못했어요" onRetry={reset} />;
}
