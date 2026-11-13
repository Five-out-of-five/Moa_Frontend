"use client";

import { PageError } from "@/components/common/PageError";

export default function WorkspacesError({ reset }: { reset: () => void }) {
  return <PageError title="워크스페이스를 불러오지 못했어요" onRetry={reset} />;
}
