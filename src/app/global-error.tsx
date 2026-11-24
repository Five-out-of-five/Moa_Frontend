"use client";

import { PageError } from "@/components/common/PageError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
        <PageError
          title="서비스를 불러오지 못했어요"
          onRetry={reset}
          digest={error.digest}
          fullPage
        />
      </body>
    </html>
  );
}
