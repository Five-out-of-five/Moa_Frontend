"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import type { ToneTarget } from "./model";
import { useToneReview } from "./useToneReview";

const SOFT_BUTTON = "border-primary/20 bg-primary/5 text-primary shadow-none hover:bg-primary/10 hover:text-primary active:bg-primary/15 focus-visible:border-primary/30 focus-visible:bg-primary/10 focus-visible:ring-primary/15";

export function ToneReview({
  target,
  value,
  onApply,
  maxLength,
  label = "검토하기",
  disabled = false,
}: {
  target: ToneTarget;
  value: string;
  onApply: (text: string) => void;
  maxLength: number;
  label?: string;
  disabled?: boolean;
}) {
  const {
    mode,
    unavailable,
    hasChanged,
    isPending,
    isOpen,
    setIsOpen,
    result,
    error,
    review,
    apply,
  } = useToneReview(target, value, maxLength, onApply);

  return (
    <>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className={SOFT_BUTTON}
        disabled={disabled || unavailable || !value.trim() || isPending}
        onClick={review}
        title={
          mode === "OFF"
            ? "계정 설정에서 순화 기능을 켜 주세요."
            : mode === null
              ? "순화 설정을 불러오지 못했어요. 새로고침해 주세요."
              : undefined
        }
      >
        <Sparkles aria-hidden="true" />{label}
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!isPending) setIsOpen(open);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>톤앤매너 검토</DialogTitle>
            <DialogDescription>
              {mode === "POLITE" ? "공손한 표현을 제안해요." : "의미를 유지하며 표현을 다듬어요."}{" "}
              적용해도 자동 저장·전송되지 않아요.
            </DialogDescription>
          </DialogHeader>
          {isPending ? (
            <div role="status" aria-label="표현 검토 중" className="space-y-3">
              <p className="text-muted-foreground text-sm">표현을 검토하고 있어요.</p>
              <Skeleton className="h-20 w-full bg-primary/5" />
              <Skeleton className="h-20 w-full bg-primary/5" />
            </div>
          ) : (
            <>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              {result && (
                <div className="space-y-4 text-sm">
                  <section>
                    <h3 className="mb-2 font-semibold">원문</h3>
                    <p className="bg-muted rounded-md p-3 break-words whitespace-pre-wrap">
                      {result.original}
                    </p>
                  </section>
                  <section>
                    <h3 className="mb-2 font-semibold">
                      {result.needsChange ? "순화 제안" : "검토 결과"}
                    </h3>
                    <p className="bg-secondary rounded-md p-3 break-words whitespace-pre-wrap">
                      {result.needsChange
                        ? result.suggestion
                        : "현재 표현도 좋아요. 원문을 그대로 사용해도 돼요."}
                    </p>
                  </section>
                </div>
              )}
              {hasChanged && (
                <p role="alert" className="text-destructive text-sm">
                  검토 후 원문이 바뀌었어요. 다시 검토해 주세요.
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" className="hover:bg-muted hover:text-foreground active:bg-muted focus-visible:ring-primary/15" onClick={() => setIsOpen(false)}>
                  원문 유지
                </Button>
                {(error || hasChanged) && (
                  <Button type="button" variant="outline" className={SOFT_BUTTON} onClick={review} disabled={!value.trim() || unavailable}>
                    다시 검토
                  </Button>
                )}
                {result?.needsChange && (
                  <Button
                    type="button"
                    variant="outline"
                    className={SOFT_BUTTON}
                    disabled={hasChanged || disabled || unavailable}
                    onClick={apply}
                  >
                    제안 적용
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
