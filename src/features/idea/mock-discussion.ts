import "server-only";

import type { Account, IdeaCard } from "@/types/db";

import type { IdeaDiscussion } from "./model";

export type MockDiscussionChange =
  | { emoji: string; selected: boolean }
  | { operation: "add" | "edit" | "remove"; commentId: number | null; content: string };

const runtime = globalThis as typeof globalThis & {
  moaIdeaDiscussions?: WeakMap<IdeaCard, IdeaDiscussion>;
  moaIdeaCommentSequence?: number;
};
const discussions = (runtime.moaIdeaDiscussions ??= new WeakMap());

export function readMockDiscussion(card: IdeaCard, seed: () => IdeaDiscussion) {
  const stored = discussions.get(card);
  if (stored) return stored;
  const result = seed();
  discussions.set(card, result);
  return result;
}

export function updateMockDiscussion(card: IdeaCard, discussion: IdeaDiscussion, account: Account, change: MockDiscussionChange) {
  if ("emoji" in change) {
    const reaction = discussion.reactions.find(({ emoji }) => emoji === change.emoji);
    const users = reaction?.users ?? [];
    const selected = users.some(({ accountId }) => accountId === account.id);
    if (selected !== change.selected) {
      const nextUsers = change.selected
        ? [...users, { accountId: account.id, displayName: account.name }]
        : users.filter(({ accountId }) => accountId !== account.id);
      const delta = change.selected ? 1 : -1;
      if (reaction) {
        reaction.count += delta;
        reaction.users = nextUsers;
      } else {
        discussion.reactions.push({ emoji: change.emoji, count: 1, users: nextUsers });
      }
      card.reactionCount += delta;
      card.reactions = discussion.reactions.map(({ emoji, count }) => ({ emoji, count }));
    }
  } else if (change.operation === "add") {
    const id = (runtime.moaIdeaCommentSequence ?? 100_000_000) + 1;
    runtime.moaIdeaCommentSequence = id;
    discussion.comments.push({ id, authorId: account.id, author: account.name, text: change.content });
    card.commentCount += 1;
  } else {
    const comment = discussion.comments.find(({ id }) => id === change.commentId);
    if (!comment || comment.deleted || comment.authorId !== account.id) return { error: "본인 댓글만 변경할 수 있어요." };
    if (change.operation === "remove") {
      comment.deleted = true;
      comment.text = "삭제된 댓글입니다.";
    } else {
      comment.edited = true;
      comment.text = change.content;
    }
  }
  return { saved: true };
}
