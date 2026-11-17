import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function PageError({
  title = "화면을 불러오지 못했어요",
  onRetry,
  children,
}: {
  title?: string;
  onRetry: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="grid justify-items-center gap-3 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-muted-foreground text-sm">잠시 후 다시 시도해 주세요.</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        다시 시도
      </Button>
      {children}
    </section>
  );
}
