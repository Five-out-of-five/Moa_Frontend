"use client";

import { Grip, MoveDiagonal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect } from "react";

import type { RoomWidget } from "@/types/db";

import { AddWidgetDialog } from "./AddWidgetDialog";
import styles from "./dashboard-grid.module.css";
import { findOpenPlacement, GRID_COLUMNS, GRID_GAP, GRID_ROW_HEIGHT } from "./grid";
import { useDashboardLayout } from "./useDashboardLayout";
import { useWidgetGesture } from "./useWidgetGesture";
import { getWidgetDetailHref, WIDGET_ICONS, WIDGET_TITLES } from "./widget-info";
import { WidgetRemovalControls } from "./WidgetRemovalControls";

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
  const router = useRouter();
  const { widgets, editors, pending, setEditing, save, applySnapshot } = useDashboardLayout(
    roomId, initialWidgets, editable,
  );
  const missingBodies = widgets.filter(({ id }) => !Object.hasOwn(bodies, id)).map(({ id }) => id).join(",");
  useEffect(() => {
    // 이벤트에는 배치만 들어 있고 위젯 본문은 서버에서 그린다.
    if (missingBodies) router.refresh();
  }, [missingBodies, router]);

  const { grid, preview, start, move, end, keyDown } = useWidgetGesture(widgets, setEditing, save);
  const projected = preview ?? pending;
  const placed = new Set(widgets.map(({ widgetType }) => widgetType));
  const canAdd = editable && placed.size < Object.keys(WIDGET_TITLES).length;
  const handlers = {
    onPointerMove: move,
    onPointerUp: (event: Parameters<typeof end>[0]) => end(event, true),
    onPointerCancel: (event: Parameters<typeof end>[0]) => end(event, false),
    onLostPointerCapture: (event: Parameters<typeof end>[0]) => end(event, false),
    "aria-disabled": pending !== null,
  };

  if (widgets.length === 0 && !canAdd) {
    return <p className="text-muted-foreground text-sm">배치된 위젯이 없습니다.</p>;
  }

  return (
    <>
    {editable && <div className="mb-3 flex justify-end">
      <WidgetRemovalControls roomId={roomId} disabled={Boolean(projected)} onChanged={applySnapshot} />
    </div>}
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
        const Icon = WIDGET_ICONS[widget.widgetType];
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
            <header className="flex min-w-0 flex-wrap items-center gap-2 px-3 pt-3 pb-1">
              <span className="bg-secondary text-primary rounded-control grid size-7 shrink-0 place-items-center">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <h2 id={`widget-title-${widget.id}`} aria-label={title} className="min-w-0 flex-1 text-sm font-semibold">
                {editable ? (
                  <>
                    <span className="sm:hidden">{title}</span>
                    <button
                      type="button"
                      aria-label={`${title} 이동`}
                      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                      title="방향키로 위젯 이동"
                      className="hidden w-full touch-none items-center gap-1.5 text-left sm:flex enabled:cursor-grab enabled:active:cursor-grabbing"
                      onPointerDown={(event) => { if (!pending) start(event, widget, "move"); }}
                      onKeyDown={(event) => { if (!pending) keyDown(event, widget, "move"); }}
                      {...handlers}
                    >
                      <Grip aria-hidden="true" className="text-muted-foreground size-3 shrink-0" />
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
              {editable && <WidgetRemovalControls roomId={roomId} widgetId={widget.id} title={title}
                isLast={widgets.length <= 1} disabled={Boolean(projected)} onChanged={applySnapshot} />}
            </header>
            <div className={`${styles.preview} min-h-0 flex-1 px-3 pt-2 pb-3 sm:overflow-clip`}>
              {bodies[widget.id] ?? (
                <p role="status" className="text-muted-foreground text-sm">위젯 데이터를 불러오는 중…</p>
              )}
            </div>
            {editable && (
              <button
                type="button"
                aria-label={`${title} 크기 조절`}
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                title="방향키로 위젯 크기 조절"
                className="bg-card text-muted-foreground absolute right-1 bottom-1 hidden size-7 touch-none place-items-center rounded sm:grid enabled:cursor-nwse-resize"
                onPointerDown={(event) => { if (!pending) start(event, widget, "resize"); }}
                onKeyDown={(event) => { if (!pending) keyDown(event, widget, "resize"); }}
                {...handlers}
              >
                <MoveDiagonal aria-hidden="true" className="size-4" />
              </button>
            )}
          </article>
        );
      })}
      {canAdd && (
        <AddWidgetDialog
          roomId={roomId}
          placed={placed}
          onAdded={applySnapshot}
          placement={findOpenPlacement(
            widgets.map((widget) => projected?.id === widget.id ? projected.placement : widget),
            6,
            3,
            3,
          )}
        />
      )}
    </div>
    </>
  );
}
