import type { ReactNode } from "react";

import { ErrorState } from "./ErrorState";

export function PageError({
  title = "화면을 불러오지 못했어요",
  onRetry,
  children,
  digest,
  fullPage = false,
}: {
  title?: string;
  onRetry: () => void;
  children?: ReactNode;
  digest?: string;
  fullPage?: boolean;
}) {
  return (
    <ErrorState
      code="500"
      title={title}
      description="일시적인 문제가 발생했어요. 잠시 후 다시 시도해 주세요."
      onRetry={onRetry}
      digest={digest}
      fullPage={fullPage}
    >
      {children}
    </ErrorState>
  );
}
