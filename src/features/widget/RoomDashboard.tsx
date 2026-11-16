import { Suspense } from "react";

import { DashboardGrid } from "./DashboardGrid";
import { canEditDashboard, listRoomWidgets } from "./server";
import { WidgetLoading, WidgetSummary } from "./WidgetSummary";

export async function RoomDashboard({ roomId }: { roomId: number }) {
  const widgets = await listRoomWidgets(roomId).catch(() => null);
  if (!widgets) {
    return <p role="alert" className="text-destructive text-sm">대시보드 배치를 불러오지 못했습니다.</p>;
  }
  const bodies = Object.fromEntries(widgets.map((widget) => [
    widget.id,
    <Suspense key={widget.id} fallback={<WidgetLoading />}>
      <WidgetSummary widget={widget} />
    </Suspense>,
  ]));
  return (
    <DashboardGrid
      key={roomId}
      roomId={roomId}
      initialWidgets={widgets}
      editable={canEditDashboard()}
      bodies={bodies}
    />
  );
}
