import type { ReactNode } from "react";

const dayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
});

export function formatWidgetDate(value: string) {
  return dayFormat.format(new Date(value));
}

export function WidgetEmpty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground rounded-control bg-muted/50 px-3 py-4 text-center text-xs">{children}</p>;
}

export function SummaryBadge({ children }: { children: ReactNode }) {
  return <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">{children}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-label="스프린트 진행률"
      aria-valuenow={value}
      className="bg-muted h-1.5 overflow-hidden rounded-full"
    >
      <div className="bg-primary h-full rounded-full" style={{ width: `${value}%` }} />
    </div>
  );
}
