import { z } from "zod";

import type { WidgetType } from "@/types/db";

import { WIDGET_MINIMUM } from "./grid";
import type { DashboardSnapshot } from "./live-types";

const widgetType = z.custom<WidgetType>(
  (value) => typeof value === "string" && Object.hasOwn(WIDGET_MINIMUM, value),
);

const dashboardResponse = z.object({
  layoutVersion: z.number().int().nonnegative(),
  widgets: z.array(
    z.object({
      widgetId: z.number().int().positive(),
      widgetType,
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
      w: z.number().int().positive(),
      h: z.number().int().positive(),
    }),
  ),
});

function mapDashboardSnapshot(roomId: number, res: z.infer<typeof dashboardResponse>): DashboardSnapshot {
  return {
    revision: res.layoutVersion,
    widgets: res.widgets.map(({ widgetId, widgetType, x, y, w, h }) => ({
      id: widgetId,
      roomId,
      widgetType,
      x,
      y,
      width: w,
      height: h,
    })),
    editors: [],
  };
}

export function toDashboardSnapshot(roomId: number, response: unknown): DashboardSnapshot {
  return mapDashboardSnapshot(roomId, dashboardResponse.parse(response));
}

export function parseDashboardSnapshot(roomId: number, response: unknown) {
  const result = dashboardResponse.safeParse(response);
  return result.success ? mapDashboardSnapshot(roomId, result.data) : null;
}
