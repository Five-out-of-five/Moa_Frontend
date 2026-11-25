"use client";

import { ClipboardList, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { isAuthor } from "@/lib/permission";
import type { BoardSession, IdeaCard } from "@/types/db";

import { IdeaCardDetails } from "./IdeaCardDetails";
import { IdeaCardDialog } from "./IdeaDialogs";
import { IdeaDraggableCard, IdeaDropColumn } from "./IdeaDrag";
import { IDEA_COLUMNS, type IdeaMovedCard, type IdeaSourceLink } from "./model";

export function IdeaBoard({ session, cards, accountId, editable, canUpload, conflictByCard = {}, sources = new Map(), openCardId }: {
  session: BoardSession; cards: IdeaCard[]; accountId: number; editable: boolean; canUpload: boolean;
  conflictByCard?: Record<number, number>;
  sources?: ReadonlyMap<number, IdeaSourceLink>;
  openCardId?: number;
}) {
  const canCreate = editable && session.state === "ACTIVE";
  const [position, setPosition] = useState<{ base: IdeaCard[]; cards: IdeaMovedCard[] }>({ base: cards, cards: [] });
  const moved = new Map(position.base === cards ? position.cards.map((card) => [card.id, card]) : []);
  const displayed = cards.map((card) => {
    const update = moved.get(card.id);
    if (!update || (card.version ?? 0) > update.version) return card;
    return { ...card, ...update, title: update.title ?? card.title, content: update.content === undefined ? card.content : update.content ?? "" };
  });
  function applyMoved(next: IdeaMovedCard[]) { setPosition({ base: cards, cards: next }); }
  return (
    <>
      {cards.length === 0 && (
        <div className="bg-card rounded-card border-border flex flex-wrap items-center justify-between gap-3 border p-3">
          <div className="flex items-center gap-2">
            <ClipboardList aria-hidden="true" className="text-primary size-4" />
            <p className="text-sm font-medium">아직 등록된 아이디어가 없어요.</p>
          </div>
          {canCreate && <IdeaCardDialog roomId={session.roomId} sessionId={session.id} canUpload={canUpload} trigger={<Button variant="outline" size="sm"><Plus aria-hidden="true" />첫 카드 추가</Button>} />}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {IDEA_COLUMNS.map(({ type, title, description, color }) => {
          const column = displayed.filter(({ cardType }) => cardType === type).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
          return (
            <IdeaDropColumn key={type} roomId={session.roomId} sessionId={session.id} cardType={type} title={title} endIndex={column.length} onMoved={applyMoved}>
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${color}`} />{title}
                    <span className="bg-secondary text-muted-foreground rounded-full px-1.5 text-xs">{column.length}</span>
                  </h2>
                  <p className="text-muted-foreground mt-1 text-xs">{description}</p>
                </div>
                {canCreate && <IdeaCardDialog roomId={session.roomId} sessionId={session.id} defaultType={type} canUpload={canUpload}
                  trigger={<Button variant="ghost" size="icon" aria-label={`${title} 카드 추가`}><Plus aria-hidden="true" /></Button>} />}
              </header>
              {column.length ? (
                <ul className="space-y-2">
                  {column.map((card, index) => (
                    <IdeaDraggableCard key={card.id} card={card} index={index} onMoved={applyMoved}><IdeaCardDetails key={card.id === openCardId ? "linked" : "board"} defaultOpen={card.id === openCardId} card={card} accountId={accountId} canUpload={canUpload} canReport={accountId > 0 && card.author.accountId > 0 && !isAuthor({ id: accountId }, card.author)} canEdit={canCreate && isAuthor({ id: accountId }, card.author)} conflictId={conflictByCard[card.id]} sources={(card.sourceCardIds ?? []).flatMap((id) => {
                      const source = sources.get(id);
                      return source ? [source] : [];
                    })} /></IdeaDraggableCard>
                  ))}
                </ul>
              ) : (
                <div className="bg-background/70 rounded-control space-y-1 p-4 text-center">
                  <p className="text-muted-foreground text-xs">아직 카드가 없어요.</p>
                  {canCreate && <IdeaCardDialog roomId={session.roomId} sessionId={session.id} defaultType={type} canUpload={canUpload}
                    trigger={<Button variant="link" size="sm">첫 카드 추가</Button>} />}
                </div>
              )}
            </IdeaDropColumn>
          );
        })}
      </div>
    </>
  );
}
