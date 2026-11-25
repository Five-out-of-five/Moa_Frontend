"use client";

import { useRouter } from "next/navigation";
import { type DragEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { IdeaCard, IdeaCardType } from "@/types/db";

import type { IdeaMovedCard } from "./model";
import { moveIdeaCard } from "./position-actions";

const CARD_DRAG = "application/x-moa-idea-card";
const dragSchema = z.object({
  id: z.number().int().positive(), roomId: z.number().int().positive(),
  sessionId: z.number().int().positive(), version: z.number().int().nonnegative(),
  cardType: z.enum(["AGENDA", "KEEP", "PROBLEM", "TRY"]), index: z.number().int().nonnegative(),
});

function allowCardDrop(event: DragEvent) {
  if (event.dataTransfer.types.includes(CARD_DRAG)) event.preventDefault();
}

async function dropCard(event: DragEvent, roomId: number, sessionId: number, cardType: IdeaCardType, index: number, onMoved: (cards: IdeaMovedCard[]) => void) {
  if (!event.dataTransfer.types.includes(CARD_DRAG)) return;
  event.preventDefault();
  event.stopPropagation();
  let input: unknown;
  try { input = JSON.parse(event.dataTransfer.getData(CARD_DRAG)); } catch { return; }
  const card = dragSchema.safeParse(input);
  if (!card.success || card.data.roomId !== roomId || card.data.sessionId !== sessionId) return;
  const toIndex = card.data.cardType === cardType && card.data.index < index ? index - 1 : index;
  if (card.data.cardType === cardType && card.data.index === toIndex) return;
  const result = await moveIdeaCard(roomId, card.data.id, { cardType, toIndex, version: card.data.version });
  if (result.cards) onMoved(result.cards);
  if (result.error) toast.error(result.error);
}

export function IdeaDropColumn({ roomId, sessionId, cardType, endIndex, title, children, onMoved }: {
  roomId: number; sessionId: number; cardType: IdeaCardType; endIndex: number; title: string; children: ReactNode;
  onMoved: (cards: IdeaMovedCard[]) => void;
}) {
  const router = useRouter();
  function onDrop(event: DragEvent<HTMLElement>) {
    void dropCard(event, roomId, sessionId, cardType, endIndex, onMoved).catch(() => toast.error("카드를 이동하지 못했어요."))
      .finally(() => router.refresh());
  }
  return (
    <section aria-label={title} className="rounded-card border-border bg-muted/40 min-h-52 min-w-0 space-y-3 border p-3 xl:min-h-96"
      onDragOver={allowCardDrop} onDrop={onDrop}>
      {children}
    </section>
  );
}

export function IdeaDraggableCard({ card, index, children, onMoved }: { card: IdeaCard; index: number; children: ReactNode; onMoved: (cards: IdeaMovedCard[]) => void }) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  return (
    <li draggable data-briefing-id={card.id}
      className="rounded-control data-briefing-highlight:ring-primary data-briefing-highlight:ring-2"
      data-dragging={isDragging || undefined}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(CARD_DRAG, JSON.stringify({
          id: card.id, roomId: card.roomId, sessionId: card.sessionId,
          version: card.version ?? 0, cardType: card.cardType, index,
        }));
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={allowCardDrop}
      onDrop={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const toIndex = event.clientY > bounds.top + bounds.height / 2 ? index + 1 : index;
        void dropCard(event, card.roomId, card.sessionId, card.cardType, toIndex, onMoved)
          .catch(() => toast.error("카드를 이동하지 못했어요.")).finally(() => router.refresh());
      }}>
      {children}
    </li>
  );
}
