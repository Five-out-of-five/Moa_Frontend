import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export function PageLoading({
  label = "화면을 불러오는 중입니다.",
  children,
}: {
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      {children ?? (
        <LoaderCircle
          aria-hidden="true"
          className="text-primary mx-auto my-8 size-6 motion-safe:animate-spin"
        />
      )}
    </div>
  );
}
