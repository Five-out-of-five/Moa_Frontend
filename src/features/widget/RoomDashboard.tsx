import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ApiError } from "@/lib/api";

import { DashboardGrid } from "./DashboardGrid";
import { getDashboardSnapshot, usesMockDashboardEvents } from "./server";
import { WidgetLoading, WidgetSummary } from "./WidgetSummary";

export async function RoomDashboard({ roomId }: { roomId: number }) {
  const result = await getDashboardSnapshot(roomId).then(
    (snapshot) => ({ snapshot }),
    (error: unknown) => {
      unstable_rethrow(error);
      if (error instanceof ApiError) {
        if (error.code === "ROOM_INACTIVE") redirect("/workspaces?roomStatus=inactive");
        if (error.code === "ROOM_NOT_FOUND" || error.code === "ROOM_NOT_MEMBER")
          redirect("/workspaces");
        return { message: error.message };
      }
      return { message: "대시보드 배치를 불러오지 못했습니다." };
    },
  );
  if (!("snapshot" in result)) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.message}
      </p>
    );
  }
  const { snapshot } = result;
  const { widgets } = snapshot;
  const bodies = Object.fromEntries(
    widgets.map((widget) => [
      widget.id,
      <Suspense key={widget.id} fallback={<WidgetLoading />}>
        <WidgetSummary widget={widget} />
      </Suspense>,
    ]),
  );
  return (
    <DashboardGrid
      key={roomId}
      roomId={roomId}
      initialSnapshot={snapshot}
      shouldOpenMockStream={usesMockDashboardEvents()}
      bodies={bodies}
    />
  );
}
