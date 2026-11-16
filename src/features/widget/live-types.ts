import type { RoomWidget } from "@/types/db";

export interface DashboardSnapshot {
  revision: number;
  widgets: RoomWidget[];
  editors: { widgetId: number; sessionId: string }[];
}
