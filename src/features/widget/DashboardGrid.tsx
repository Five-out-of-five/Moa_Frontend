"use client";

import { ArrowUpRight, Grip, MoveDiagonal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect } from "react";

import { LayoutRecommendation } from "@/features/ai/LayoutRecommendation";

import { AddWidgetDialog } from "./AddWidgetDialog";
import styles from "./dashboard-grid.module.css";
import { findOpenPlacement, GRID_COLUMNS, GRID_GAP, GRID_ROW_HEIGHT } from "./grid";
import type { DashboardSnapshot } from "./live-types";
import { useDashboardLayout } from "./useDashboardLayout";
import { useWidgetGesture } from "./useWidgetGesture";
import { getWidgetDetailHref, WIDGET_ICONS, WIDGET_TITLES } from "./widget-info";
import { WidgetRemovalControls } from "./WidgetRemovalControls";

export function DashboardGrid({
  roomId,
  accountId,
  initialSnapshot,
  shouldOpenMockStream,
  bodies,
}: {
  roomId: number;
  accountId: number;
  initialSnapshot: DashboardSnapshot;
  shouldOpenMockStream: boolean;
  bodies: Record<number, ReactNode>;
}) {
  const router = useRouter();
  const { revision, widgets, editors, reconnecting, pending, setEditing, save, applySnapshot } = useDashboardLayout(
    roomId,
    accountId,
    initialSnapshot,
    shouldOpenMockStream,
  );
  const missingBodies = widgets
    .filter(({ id }) => !Object.hasOwn(bodies, id))
    .map(({ id }) => id)
    .join(",");
  useEffect(() => {
    // 이벤트에는 배치만 들어 있고 위젯 본문은 서버에서 그린다.
    if (missingBodies) router.refresh();
  }, [missingBodies, router]);

  const { grid, preview, start, move, end, keyDown } = useWidgetGesture(widgets, setEditing, save);
  const projected = preview ?? pending;
  const placed = new Set(widgets.map(({ widgetType }) => widgetType));
  const canAdd = placed.size < Object.keys(WIDGET_TITLES).length;
  const handlers = {
    onPointerMove: move,
    onPointerUp: (event: Parameters<typeof end>[0]) => end(event, true),
    onPointerCancel: (event: Parameters<typeof end>[0]) => end(event, false),
    onLostPointerCapture: (event: Parameters<typeof end>[0]) => end(event, false),
    "aria-disabled": pending !== null,
  };

  return (
    <>
      <div className="mb-3 overflow-x-auto p-1">
        <div
          role="group"
          aria-label="대시보드 레이아웃"
          className="ml-auto flex w-max items-center gap-2"
        >
          <LayoutRecommendation roomId={roomId} revision={revision} widgets={widgets} onChanged={applySnapshot} />
          <WidgetRemovalControls
            roomId={roomId}
            disabled={Boolean(projected)}
            onChanged={applySnapshot}
          />
        </div>
      </div>
      {reconnecting && <p role="status" className="text-muted-foreground mb-3 text-sm">실시간 연결을 다시 시도하고 있어요.</p>}
      {widgets.length === 0 && (
        <p className="text-muted-foreground text-sm">배치된 위젯이 없습니다.</p>
      )}
      <div
        ref={grid}
        className="grid grid-cols-1 gap-[var(--widget-gap)] sm:auto-rows-[var(--widget-row)] sm:grid-cols-[var(--widget-columns)]"
        style={
          {
            "--widget-columns": `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
            "--widget-row": `${GRID_ROW_HEIGHT}px`,
            "--widget-gap": `${GRID_GAP}px`,
          } as CSSProperties
        }
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
              className="bg-card text-card-foreground border-border rounded-card relative flex min-h-32 min-w-0 flex-col border has-[[data-briefing-hidden]]:hidden sm:col-[var(--widget-column)] sm:row-[var(--widget-grid-row)]"
              style={
                {
                  "--widget-column": `${placement.x + 1} / span ${placement.width}`,
                  "--widget-grid-row": `${placement.y + 1} / span ${placement.height}`,
                } as CSSProperties
              }
            >
              <header className="flex min-w-0 flex-wrap items-center gap-2 px-3 pt-3 pb-1">
                <span className="bg-secondary text-primary rounded-control grid size-7 shrink-0 place-items-center">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <h2
                  id={`widget-title-${widget.id}`}
                  aria-label={title}
                  className="min-w-0 flex-1 text-sm font-semibold"
                >
                  <span className="sm:hidden">{title}</span>
                  <button
                    type="button"
                    aria-label={`${title} 이동`}
                    aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                    title="방향키로 위젯 이동"
                    className="hidden w-full touch-none items-center gap-1.5 text-left enabled:cursor-grab enabled:active:cursor-grabbing sm:flex"
                    onPointerDown={(event) => {
                      if (!pending) start(event, widget, "move");
                    }}
                    onKeyDown={(event) => {
                      if (!pending) keyDown(event, widget, "move");
                    }}
                    {...handlers}
                  >
                    <Grip aria-hidden="true" className="text-muted-foreground size-3 shrink-0" />
                    {title}
                  </button>
                </h2>
                {isEdited && (
                  <span
                    role="status"
                    className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs"
                  >
                    편집 중
                  </span>
                )}
                <WidgetRemovalControls
                  roomId={roomId}
                  widgetId={widget.id}
                  title={title}
                  isLast={widgets.length <= 1}
                  disabled={Boolean(projected)}
                  onChanged={applySnapshot}
                />
              </header>
              <div className={`${styles.preview} min-h-0 flex-1 px-3 pt-2 sm:overflow-clip`}>
                {bodies[widget.id] ?? (
                  <p role="status" className="text-muted-foreground text-sm">
                    위젯 데이터를 불러오는 중…
                  </p>
                )}
              </div>
              <div className="flex min-h-8 shrink-0 items-center gap-1 px-1 pb-1">
                <button
                  type="button"
                  aria-label={`${title} 크기 조절`}
                  aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                  title="방향키로 위젯 크기 조절"
                  className="bg-card text-muted-foreground hidden size-7 touch-none place-items-center rounded enabled:cursor-nwse-resize sm:grid"
                  onPointerDown={(event) => {
                    if (!pending) start(event, widget, "resize");
                  }}
                  onKeyDown={(event) => {
                    if (!pending) keyDown(event, widget, "resize");
                  }}
                  {...handlers}
                >
                  <MoveDiagonal aria-hidden="true" className="size-4" />
                </button>
                {href && (
                  <Link
                    href={href}
                    aria-label={`${title} 상세로 이동`}
                    title={`${title} 상세로 이동`}
                    className="bg-card text-primary hover:bg-secondary focus-visible:ring-ring ml-auto grid size-7 place-items-center rounded focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
        {canAdd && (
          <AddWidgetDialog
            roomId={roomId}
            placed={placed}
            onAdded={applySnapshot}
            placement={findOpenPlacement(
              widgets.map((widget) => (projected?.id === widget.id ? projected.placement : widget)),
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
