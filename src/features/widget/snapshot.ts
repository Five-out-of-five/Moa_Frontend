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

export function toDashboardSnapshot(roomId: number, response: unknown): DashboardSnapshot {
  const res = dashboardResponse.parse(response);
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
