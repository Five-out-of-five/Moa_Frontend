"use client";

import { PageError } from "@/components/common/PageError";

export default function WorkspaceManagementError({ reset }: { reset: () => void }) {
  return <PageError title="워크스페이스 관리 정보를 불러오지 못했어요" onRetry={reset} />;
}
