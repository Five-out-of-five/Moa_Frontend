"use client";

import { Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { confirmBriefingAction } from "./actions";

export function BriefingConfirm({ roomId, keys, label }: { roomId: number; keys?: string[]; label: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant={keys ? "ghost" : "outline"} disabled={pending}
      className={keys ? "text-primary h-auto justify-start px-0 py-1 text-xs" : undefined}
      onClick={() => startTransition(async () => {
        try {
          const result = await confirmBriefingAction(roomId, keys);
          if (!result.ok) {
            toast.error("이 소식을 확인할 수 없어요. 목록을 새로고침해 주세요.");
          } else if (result.href) {
            router.push(result.href);
          } else if (keys) {
            toast.info("이미 삭제됐거나 접근할 수 없는 항목이에요.");
          } else {
            toast.success("팀 소식을 모두 확인했어요.");
          }
        } catch {
          toast.error("확인 상태를 저장하지 못했어요. 다시 시도해 주세요.");
        }
      })}>
      {!keys && <Check aria-hidden="true" className="size-4" />}
      {pending ? "처리 중…" : label}
      {keys && <ChevronRight aria-hidden="true" className="size-3" />}
    </Button>
  );
}
