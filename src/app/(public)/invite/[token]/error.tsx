"use client";

import { PageError } from "@/components/common/PageError";

export default function InviteError({ reset }: { reset: () => void }) {
  return <PageError title="초대 정보를 불러오지 못했어요" onRetry={reset} />;
}
