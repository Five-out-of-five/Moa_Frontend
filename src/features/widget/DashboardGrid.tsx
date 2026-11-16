"use client";

import { Grip, MoveDiagonal } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import type { RoomWidget } from "@/types/db";

import { GRID_COLUMNS, GRID_GAP, GRID_ROW_HEIGHT } from "./grid";
import { useDashboardLayout } from "./useDashboardLayout";
import { useWidgetGesture } from "./useWidgetGesture";
import { getWidgetDetailHref, WIDGET_TITLES } from "./widget-info";

export function DashboardGrid({
  roomId,
  initialWidgets,
  editable,
  bodies,
}: {
  roomId: number;
  initialWidgets: RoomWidget[];
  editable: boolean;
  bodies: Record<number, ReactNode>;
}) {
  const { widgets, editors, pending, setEditing, save } = useDashboardLayout(
    roomId, initialWidgets, editable,
  );
  const { grid, preview, start, move, end } = useWidgetGesture(widgets, setEditing, save);
  const projected = preview ?? pending;
  const handlers = {
    onPointerMove: move,
    onPointerUp: (event: Parameters<typeof end>[0]) => end(event, true),
    onPointerCancel: (event: Parameters<typeof end>[0]) => end(event, false),
    onLostPointerCapture: (event: Parameters<typeof end>[0]) => end(event, false),
    disabled: pending !== null,
  };

  if (widgets.length === 0) {
    return <p className="text-muted-foreground text-sm">배치된 위젯이 없습니다.</p>;
  }

  return (
    <div
      ref={grid}
      className="grid grid-cols-1 gap-[var(--widget-gap)] sm:auto-rows-[var(--widget-row)] sm:grid-cols-[var(--widget-columns)]"
      style={{
        "--widget-columns": `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
        "--widget-row": `${GRID_ROW_HEIGHT}px`,
        "--widget-gap": `${GRID_GAP}px`,
      } as CSSProperties}
    >
      {widgets.map((widget) => {
        const placement = projected?.id === widget.id ? projected.placement : widget;
        const title = WIDGET_TITLES[widget.widgetType];
        const href = getWidgetDetailHref(roomId, widget.widgetType);
        const isEdited = editors.some(({ widgetId }) => widget.id === widgetId);

        return (
          <article
            key={widget.id}
            aria-labelledby={`widget-title-${widget.id}`}
            className="bg-card text-card-foreground border-border rounded-card relative flex min-h-32 min-w-0 flex-col border sm:col-[var(--widget-column)] sm:row-[var(--widget-grid-row)]"
            style={{
              "--widget-column": `${placement.x + 1} / span ${placement.width}`,
              "--widget-grid-row": `${placement.y + 1} / span ${placement.height}`,
            } as CSSProperties}
          >
            <header className="border-border flex min-w-0 flex-wrap items-center gap-x-2 border-b px-3 py-2">
              <h2 id={`widget-title-${widget.id}`} aria-label={title} className="min-w-0 flex-1 text-sm font-semibold">
                {editable ? (
                  <>
                    <span className="sm:hidden">{title}</span>
                    <button
                      type="button"
                      aria-label={`${title} 이동`}
                      className="hidden w-full touch-none items-center gap-1.5 text-left sm:flex enabled:cursor-grab enabled:active:cursor-grabbing"
                      onPointerDown={(event) => start(event, widget, "move")}
                      {...handlers}
                    >
                      <Grip aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                      {title}
                    </button>
                  </>
                ) : title}
              </h2>
              {isEdited && (
                <span role="status" className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs">
                  편집 중
                </span>
              )}
              {href && <Link href={href} className="text-primary text-xs hover:underline">전체 보기</Link>}
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-3">{bodies[widget.id]}</div>
            {editable && (
              <button
                type="button"
                aria-label={`${title} 크기 조절`}
                className="bg-card text-muted-foreground absolute right-1 bottom-1 hidden size-7 touch-none place-items-center rounded sm:grid enabled:cursor-nwse-resize"
                onPointerDown={(event) => start(event, widget, "resize")}
                {...handlers}
              >
                <MoveDiagonal aria-hidden="true" className="size-4" />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
