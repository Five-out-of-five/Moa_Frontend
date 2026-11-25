"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TaskCreateDialog } from "@/features/task/components/TaskCreateDialog";
import { VoteCreateDialog } from "@/features/vote/components/VoteCreateDialog";
import type { IdeaCard } from "@/types/db";

import { loadIdeaTaskOptions } from "./discussion-actions";

export function IdeaCardLinks({ card, canCreate, accountId }: { card: IdeaCard; canCreate: boolean; accountId: number }) {
  const router = useRouter();
  const [voteOpen, setVoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskOptions, setTaskOptions] = useState<Awaited<ReturnType<typeof loadIdeaTaskOptions>>>();
  const [loading, startTransition] = useTransition();
  const root = `/rooms/${card.roomId}`;

  return (
    <div className="flex flex-wrap gap-2">
      {card.convertedTaskId ? <Button asChild variant="outline" size="sm">
        <Link href={`${root}/boards/task?open=${card.convertedTaskId}`}>연결된 업무</Link>
      </Button> : canCreate && <Button variant="outline" size="sm" disabled={loading} onClick={() => startTransition(async () => {
        try {
          const data = await loadIdeaTaskOptions(card.roomId);
          if (data.error) toast.error(data.error);
          else { setTaskOptions(data); setTaskOpen(true); }
        } catch {
          toast.error("업무 등록 정보를 불러오지 못했어요.");
        }
      })}>{loading ? "불러오는 중…" : "업무로 전환"}</Button>}
      {card.linkedVote ? <Button asChild variant="outline" size="sm">
        <Link href={`${root}/votes?open=${card.linkedVote.id}`}>연결된 투표 · {card.linkedVote.status === "OPEN" ? "진행 중" : "마감"}</Link>
      </Button> : canCreate && card.cardType === "AGENDA" && <Button size="sm" variant="outline" onClick={() => setVoteOpen(true)}>투표 만들기</Button>}
      {taskOptions?.members && <TaskCreateDialog
        roomId={card.roomId} sourceCard={card} members={taskOptions.members} defaultAssigneeAccountId={accountId}
        activeSprint={taskOptions.activeSprint ?? null} open={taskOpen} onOpenChange={setTaskOpen}
        onCreated={() => { setTaskOpen(false); router.refresh(); }}
      />}
      {voteOpen && <VoteCreateDialog roomId={card.roomId} sourceCard={card} open={voteOpen} onOpenChange={setVoteOpen}
        onCreated={() => { setVoteOpen(false); router.refresh(); }} />}
    </div>
  );
}
