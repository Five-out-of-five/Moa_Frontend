"use client";

import { PageError } from "@/components/common/PageError";

export default function FirstProfileError({ reset }: { reset: () => void }) {
  return <PageError title="워크스페이스 프로필을 불러오지 못했어요" onRetry={reset} />;
}
