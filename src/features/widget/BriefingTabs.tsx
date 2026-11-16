"use client";

import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

export function BriefingTabs({
  pendingCount,
  newsCount,
  pending,
  news,
}: {
  pendingCount: number;
  newsCount: number;
  pending: ReactNode;
  news: ReactNode;
}) {
  const tabStyle = "rounded-control px-1 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-card data-[state=active]:text-foreground";
  return (
    <Tabs.Root defaultValue="pending" className="space-y-2">
      <Tabs.List aria-label="브리핑 구분" className="bg-muted text-muted-foreground rounded-control grid grid-cols-2 gap-1 p-1">
        <Tabs.Trigger value="pending" className={tabStyle}>내가 할 일 {pendingCount}</Tabs.Trigger>
        <Tabs.Trigger value="news" className={tabStyle}>팀 소식 {newsCount}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="pending">{pending}</Tabs.Content>
      <Tabs.Content value="news">{news}</Tabs.Content>
    </Tabs.Root>
  );
}
