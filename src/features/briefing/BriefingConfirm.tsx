"use client";

import { Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { confirmBriefingAction } from "./actions";
import type { BriefingEventType } from "./model";

export function BriefingConfirm({ roomId, eventType, href, label }: { roomId: number; eventType?: BriefingEventType; href?: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant={eventType ? "ghost" : "outline"} disabled={pending}
      className={eventType ? "text-primary h-auto justify-start px-0 py-1 text-xs" : undefined}
      onClick={() => startTransition(async () => {
        try {
          const result = await confirmBriefingAction(roomId, eventType);
          if (!result.ok) {
            toast.error(result.error);
          } else if (href) {
            router.push(href);
          } else if (eventType) {
            toast.success("이 소식 묶음을 확인했어요.");
          } else {
            toast.success("팀 소식을 모두 확인했어요.");
          }
        } catch {
          toast.error("확인 상태를 저장하지 못했어요. 다시 시도해 주세요.");
        }
      })}>
      {!eventType && <Check aria-hidden="true" className="size-4" />}
      {pending ? "처리 중…" : label}
      {href && <ChevronRight aria-hidden="true" className="size-3" />}
    </Button>
  );
}
