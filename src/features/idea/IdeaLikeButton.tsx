"use client";

import { ThumbsUp } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { setIdeaReaction } from "./discussion-actions";

export function IdeaLikeButton({ roomId, cardId, count, selected }: { roomId: number; cardId: number; count: number; selected: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="text-muted-foreground hover:text-primary aria-pressed:text-primary flex items-center gap-1 rounded p-1 text-xs"
      aria-label={`좋아요 ${count}개`} aria-pressed={selected} disabled={pending}
      onClick={() => startTransition(async () => {
        try {
          const result = await setIdeaReaction(roomId, cardId, "THUMBS_UP", !selected);
          if (result.error) toast.error(result.error);
        } catch {
          toast.error("좋아요를 저장하지 못했어요.");
        }
      })}>
      <ThumbsUp aria-hidden="true" className="size-3" />{count}
    </button>
  );
}
