"use client";

import { PageError } from "@/components/common/PageError";

export default function SignupError({ reset }: { reset: () => void }) {
  return <PageError title="가입 정보를 불러오지 못했어요" onRetry={reset} />;
}
