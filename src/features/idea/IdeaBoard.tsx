import { ClipboardList, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isAuthor } from "@/lib/permission";
import type { BoardSession, IdeaCard } from "@/types/db";

import { IdeaCardDetails } from "./IdeaCardDetails";
import { IdeaCardDialog } from "./IdeaDialogs";
import { IDEA_COLUMNS, type IdeaDiscussion } from "./model";

export function IdeaBoard({ session, cards, accountId, editable, discussion, conflictByCard = {} }: {
  session: BoardSession; cards: IdeaCard[]; accountId: number; editable: boolean;
  discussion: Record<number, IdeaDiscussion>;
  conflictByCard?: Record<number, number>;
}) {
  const canCreate = editable && session.state === "ACTIVE";
  return (
    <>
      {cards.length === 0 && (
        <div className="bg-card rounded-card border-border flex flex-wrap items-center justify-between gap-3 border p-3">
          <div className="flex items-center gap-2">
            <ClipboardList aria-hidden="true" className="text-primary size-4" />
            <p className="text-sm font-medium">아직 등록된 아이디어가 없어요.</p>
          </div>
          {canCreate && <IdeaCardDialog roomId={session.roomId} sessionId={session.id} trigger={<Button variant="outline" size="sm"><Plus aria-hidden="true" />첫 카드 추가</Button>} />}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {IDEA_COLUMNS.map(({ type, title, description, color }) => {
          const column = cards.filter(({ cardType }) => cardType === type).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
          return (
            <section aria-label={title} key={type} className="rounded-card border-border bg-muted/40 min-h-52 min-w-0 space-y-3 border p-3 xl:min-h-96">
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${color}`} />{title}
                    <span className="bg-secondary text-muted-foreground rounded-full px-1.5 text-xs">{column.length}</span>
                  </h2>
                  <p className="text-muted-foreground mt-1 text-xs">{description}</p>
                </div>
                {canCreate && <IdeaCardDialog roomId={session.roomId} sessionId={session.id} defaultType={type}
                  trigger={<Button variant="ghost" size="icon" aria-label={`${title} 카드 추가`}><Plus aria-hidden="true" /></Button>} />}
              </header>
              {column.length ? (
                <ul className="space-y-2">
                  {column.map((card) => (
                    <li key={card.id} data-briefing-id={card.id} className="rounded-control data-briefing-highlight:ring-primary data-briefing-highlight:ring-2"><IdeaCardDetails card={card} canEdit={canCreate && isAuthor({ id: accountId }, card.author)} discussion={discussion[card.id]} conflictId={conflictByCard[card.id]} /></li>
                  ))}
                </ul>
              ) : (
                <div className="bg-background/70 rounded-control space-y-1 p-4 text-center">
                  <p className="text-muted-foreground text-xs">아직 카드가 없어요.</p>
                  {canCreate && <IdeaCardDialog roomId={session.roomId} sessionId={session.id} defaultType={type}
                    trigger={<Button variant="link" size="sm">첫 카드 추가</Button>} />}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
