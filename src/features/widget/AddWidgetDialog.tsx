"use client";

import { BarChart3, Check, ClipboardList, Lightbulb, Plus, Scale, Smile, Vote, X } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WidgetType } from "@/types/db";

import { addWidgetAction } from "./actions";
import type { WidgetPlacement } from "./grid";
import type { DashboardSnapshot } from "./live-types";
import { WIDGET_TITLES } from "./widget-info";

const WIDGET_OPTIONS = [
  { type: "MOOD", icon: Smile, description: "팀의 오늘 상태와 기분" },
  { type: "IDEA_BOARD", icon: Lightbulb, description: "팀의 아이디어와 회고" },
  { type: "TASK_BOARD", icon: ClipboardList, description: "스프린트 업무와 진행 상태" },
  { type: "CATCHUP_BRIEFING", icon: ClipboardList, description: "놓친 업무와 팀 소식" },
  { type: "VOTE", icon: Vote, description: "진행 중인 투표와 참여 현황" },
  { type: "MEDIATION", icon: Scale, description: "대립하는 의견과 절충안" },
  { type: "PROGRESS", icon: BarChart3, description: "스프린트 업무 진행률" },
] as const satisfies { type: WidgetType; icon: typeof Smile; description: string }[];

export function AddWidgetDialog({
  roomId,
  placed,
  placement,
  onAdded,
}: {
  roomId: number;
  placed: ReadonlySet<WidgetType>;
  placement: WidgetPlacement;
  onAdded: (snapshot: DashboardSnapshot) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<WidgetType | null>(null);
  const [isPending, setIsPending] = useState(false);
  const canSubmit = selected !== null && !placed.has(selected) && !isPending;

  function changeOpen(open: boolean) {
    if (isPending) return;
    if (!open) setSelected(null);
    setIsOpen(open);
  }

  async function add() {
    if (!canSubmit || selected === null) return;
    setIsPending(true);
    try {
      const result = await addWidgetAction(roomId, selected);
      if (result.snapshot) onAdded(result.snapshot);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setIsOpen(false);
      setSelected(null);
      toast.success("위젯을 추가했습니다.");
    } catch {
      toast.error("위젯을 추가하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="위젯 추가"
          className="rounded-card border-primary/25 bg-secondary/50 text-secondary-foreground hover:bg-secondary focus-visible:ring-ring flex min-h-32 min-w-0 flex-col items-center justify-center gap-2 border border-dashed p-4 text-center focus-visible:ring-2 sm:col-[var(--widget-column)] sm:row-[var(--widget-grid-row)]"
          style={{
            "--widget-column": `${placement.x + 1} / span ${placement.width}`,
            "--widget-grid-row": `${placement.y + 1} / span ${placement.height}`,
          } as CSSProperties}
        >
          <span className="bg-card text-primary border-border rounded-control grid size-9 place-items-center border">
            <Plus aria-hidden="true" className="size-4" />
          </span>
          <span className="text-sm font-semibold">위젯 추가</span>
          <span className="text-muted-foreground text-xs">필요한 위젯을 대시보드에 배치하세요.</span>
        </button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="relative px-4 pt-4 pb-3 pr-12 text-left">
          <DialogTitle>위젯 추가</DialogTitle>
          <DialogDescription>대시보드에 표시할 위젯을 선택하세요.</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-2 right-2" aria-label="닫기" disabled={isPending}>
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <fieldset disabled={isPending} className="min-h-0 space-y-1.5 overflow-auto px-4 pb-3">
            <legend className="sr-only">추가할 위젯</legend>
            {WIDGET_OPTIONS.map(({ type, icon: Icon, description }) => {
              const isPlaced = placed.has(type);
              const isSelected = !isPlaced && selected === type;
              return (
                <label
                  key={type}
                  className={`rounded-control flex items-center gap-2 border p-2.5 focus-within:ring-2 focus-within:ring-ring ${
                    isPlaced ? "border-transparent bg-muted text-muted-foreground"
                      : isSelected ? "border-primary bg-secondary cursor-pointer"
                        : "border-border hover:bg-muted cursor-pointer"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="widgetType"
                    value={type}
                    disabled={isPlaced}
                    checked={isSelected}
                    onChange={() => setSelected(type)}
                  />
                  <span className="bg-secondary text-secondary-foreground rounded-control grid size-8 shrink-0 place-items-center">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{WIDGET_TITLES[type]}</span>
                    <span className="text-muted-foreground block text-xs">{description}</span>
                  </span>
                  {isPlaced ? (
                    <span className="bg-secondary rounded px-1.5 py-0.5 text-xs">추가됨</span>
                  ) : (
                    <span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                      isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border"
                    }`}>
                      {isSelected && <Check className="size-3" />}
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
          <DialogFooter className="bg-muted/50 border-border border-t px-4 py-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>취소</Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              <Plus aria-hidden="true" />
              {isPending ? "추가 중…" : "추가하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
