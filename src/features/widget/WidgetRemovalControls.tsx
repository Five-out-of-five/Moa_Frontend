"use client";

import { MoreHorizontal, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { removeWidgetAction, resetWidgetLayoutAction } from "./actions";
import type { DashboardSnapshot } from "./live-types";

export function WidgetRemovalControls({
  roomId, widgetId, title, isLast, disabled, onChanged,
}: {
  roomId: number; widgetId?: number; title?: string; isLast?: boolean; disabled?: boolean;
  onChanged: (snapshot: DashboardSnapshot) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const isReset = widgetId === undefined;
  return <>
    {isReset ? (
      <Button variant="outline" size="sm" disabled={disabled || pending} onClick={() => setOpen(true)}>
        <RotateCcw aria-hidden="true" />레이아웃 초기화
      </Button>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={disabled || pending} aria-label={`${title} 위젯 메뉴`}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isLast} onSelect={() => setOpen(true)} className="text-destructive">위젯 삭제</DropdownMenuItem>
          {isLast && <p className="text-muted-foreground max-w-48 px-2 py-1 text-xs">위젯은 최소 1개를 유지해야 해요.</p>}
        </DropdownMenuContent>
      </DropdownMenu>
    )}
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isReset ? "레이아웃을 초기화할까요?" : `${title} 위젯을 삭제할까요?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {isReset
              ? "모든 멤버의 대시보드를 기본 위젯 4개와 기본 배치로 복원해요. 이전 배치는 복구할 수 없으며, 카드·업무·투표 데이터는 보존돼요."
              : "모든 멤버의 대시보드에서 이 위젯이 사라져요. 데이터는 보존되며 위젯 추가에서 다시 표시할 수 있어요."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
            try {
              const result = isReset ? await resetWidgetLayoutAction(roomId) : await removeWidgetAction(roomId, widgetId);
              if (result.snapshot) onChanged(result.snapshot);
              if (!result.ok) { toast.error(result.message); return; }
              setOpen(false);
              toast.success(isReset ? "기본 배치로 초기화했어요." : "위젯을 삭제했어요.");
            } catch {
              toast.error("변경 사항을 저장하지 못했어요. 다시 시도해 주세요.");
            }
          })}>{pending ? "처리 중…" : isReset ? "초기화하기" : "삭제하기"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
