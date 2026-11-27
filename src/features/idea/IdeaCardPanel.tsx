"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRoomRealtime } from "@/features/realtime/RoomRealtimeProvider";
import { ReportMenu } from "@/features/report/ReportMenu";
import type { IdeaCard } from "@/types/db";

import { changeIdeaComment, loadIdeaCardDetail, setIdeaReaction } from "./discussion-actions";
import { attachIdeaFile, removeIdeaFile } from "./file-actions";
import { IdeaCardLinks } from "./IdeaCardLinks";
import { DeleteIdeaDialog, IdeaCardDialog } from "./IdeaDialogs";
import { IDEA_REACTIONS, type IdeaFormResult } from "./model";
import { shouldReloadIdeaCard } from "./realtime-events";

export function IdeaCardPanel({ card, accountId, canUpload, canEdit, locked, children }: {
  card: IdeaCard; accountId: number; canUpload: boolean; canEdit: boolean; locked: boolean;
  children: React.ReactNode;
}) {
  const { id, roomId } = card;
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof loadIdeaCardDetail>>>();
  const [revision, setRevision] = useState(0);
  const [pending, startTransition] = useTransition();
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const reload = () => setRevision((value) => value + 1);
  const realtime = useRoomRealtime();
  const listen = realtime?.listen;
  const generation = realtime?.connectionGeneration ?? 0;
  const sessionId = card.sessionId;

  useEffect(() => listen?.((event) => {
    if (shouldReloadIdeaCard(event, id, sessionId)) setRevision((value) => value + 1);
  }), [id, listen, sessionId]);

  useEffect(() => {
    let active = true;
    void loadIdeaCardDetail(roomId, id).then((value) => {
      if (active) setDetail(value);
    }).catch(() => {
      if (active) setDetail({ error: "카드 상세를 불러오지 못했어요." });
    });
    return () => { active = false; };
  }, [roomId, id, revision, generation, card.version, card.commentCount, card.reactionCount, card.fileCount]);

  function change(action: () => Promise<IdeaFormResult>, onSaved?: () => void) {
    if (pending) return;
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) toast.error(result.error);
        if (result.saved) onSaved?.();
      } catch {
        toast.error("변경 사항을 저장하지 못했어요.");
      } finally {
        reload();
      }
    });
  }

  if (!detail) return <p role="status" className="text-sm">카드 상세를 불러오는 중이에요.</p>;
  if (detail.error || !detail.discussion) return (
    <div className="space-y-2"><p role="alert">{detail.error ?? "카드 상세를 불러오지 못했어요."}</p>
      <Button variant="outline" onClick={reload}>다시 시도</Button>
    </div>
  );
  const { discussion } = detail;
  const editable = accountId > 0 && !detail.closed;
  const files = detail.card?.files ?? [];
  const conflict = detail.card?.conflicts?.find((item) => item.conflictId);
  const root = `/rooms/${roomId}`;
  const fullCard = { ...card, title: detail.card?.title ?? card.title, content: detail.card?.content ?? card.content };
  return (
    <>
      {locked && <p role="status" className="text-warning text-sm">다른 멤버가 이 카드를 편집 중이에요.</p>}
      <p className="text-sm break-words whitespace-pre-wrap">{detail.card?.content ?? (card.content || "등록된 내용이 없어요.")}</p>
      {conflict?.conflictId && <a className="text-primary text-sm underline" href={`${root}/mediation?conflict=${conflict.conflictId}`}>충돌 의견 비교</a>}
      {children}
      {editable && canEdit && (
        <div className="flex flex-wrap gap-2">
          <IdeaCardDialog roomId={roomId} sessionId={card.sessionId} card={fullCard} trigger={<Button variant="outline" disabled={locked}>카드 수정</Button>} />
          <DeleteIdeaDialog roomId={roomId} cardId={id} trigger={<Button variant="destructive">카드 삭제</Button>} />
          {card.cardType === "AGENDA" && !card.linkedVote && (
            // ⚠️ AGENDA(안건) 카드이면서 아직 연결된 투표가 없을 때만 "투표로 전환" 을 띄운다.
            //    투표 페이지가 ?sourceCard=<id> 쿼리를 받으면 카드 title·content 를 prefill 한
            //    상태로 VoteCreateDialog 를 자동으로 연다.
            <Button asChild variant="outline" disabled={locked}>
              <Link href={`/rooms/${roomId}/votes?sourceCard=${id}`}>투표로 전환</Link>
            </Button>
          )}
        </div>
      )}
      <IdeaCardLinks card={fullCard} canCreate={editable} accountId={accountId} />
      <section aria-label="첨부 파일" className="space-y-2 border-t pt-3 text-sm">
        <h3 className="font-semibold">첨부 파일 {files.length}개</h3>
        <ul className="space-y-1">
          {files.map(({ fileId, originalName }) => fileId && (
            <li key={fileId} className="flex items-center justify-between gap-2">
              <a className="text-primary break-all underline" href={`/api/rooms/${roomId}/files/${fileId}/download`}>{originalName ?? "첨부 파일 다운로드"}</a>
              {editable && canEdit && <Button size="sm" variant="outline" disabled={pending}
                onClick={() => change(() => removeIdeaFile(roomId, id, fileId))}>첨부 삭제</Button>}
            </li>
          ))}
        </ul>
        {editable && canEdit && canUpload && files.length < 5 && (
          <form className="flex items-center gap-2" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            change(() => attachIdeaFile(roomId, id, data), () => form.reset());
          }}>
            <Input type="file" name="file" required aria-label="추가할 첨부 파일" disabled={pending} />
            <Button type="submit" variant="outline" disabled={pending}>첨부</Button>
          </form>
        )}
      </section>
      <section aria-label="리액션" className="space-y-2 border-t pt-3 text-sm">
        <h3 className="font-semibold">리액션</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(IDEA_REACTIONS).map(([key, label]) => {
            const reaction = discussion.reactions.find(({ emoji }) => emoji === key);
            const isSelected = reaction?.users?.some(({ accountId: id }) => id === accountId) ?? false;
            return <div key={key} className="space-y-1">
              <Button size="sm" variant={isSelected ? "secondary" : "outline"}
                aria-pressed={isSelected} disabled={!editable || pending}
                onClick={() => change(() => setIdeaReaction(roomId, id, key, !isSelected))}>
                {label} {reaction?.count ?? 0}
              </Button>
              {!!reaction?.users?.length && <details className="text-xs"><summary>참여자</summary>
                <ul>{reaction.users.map((user) => <li key={user.accountId}>{user.displayName ?? "알 수 없는 사용자"}</li>)}</ul>
              </details>}
            </div>;
          })}
        </div>
      </section>
      <section aria-label="댓글" className="space-y-2 border-t pt-3 text-sm">
        <h3 className="font-semibold">댓글 {discussion.comments.length}개</h3>
        {!discussion.comments.length && <p>남겨진 댓글이 없어요.</p>}
        {discussion.comments.map((comment) => (
          <article key={comment.id} className="bg-muted rounded-control p-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{comment.author} {comment.edited && "· 수정됨"}</span>
              {!comment.deleted && accountId > 0 && comment.authorId > 0 && comment.authorId !== accountId && (
                <ReportMenu target={{ roomId, id: comment.id, type: "COMMENT", author: comment.author, content: comment.text }} />
              )}
            </div>
            {editingComment === comment.id ? (
              <form className="space-y-2" onSubmit={(event) => {
                event.preventDefault();
                change(() => changeIdeaComment(roomId, id, "edit", comment.id, draft), () => setEditingComment(null));
              }}>
                <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} aria-label="댓글 수정" />
                <Button size="sm" type="submit" disabled={pending || !draft.trim()}>저장</Button>
                <Button size="sm" type="button" variant="ghost" onClick={() => setEditingComment(null)}>취소</Button>
              </form>
            ) : <p className="whitespace-pre-wrap break-words">{comment.text}</p>}
            {editable && !comment.deleted && comment.authorId === accountId && editingComment !== comment.id && (
              <div className="mt-1 flex gap-1">
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setEditingComment(comment.id); setDraft(comment.text); }}>수정</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => change(() => changeIdeaComment(roomId, id, "remove", comment.id, ""))}>삭제</Button>
              </div>
            )}
          </article>
        ))}
        {editable && <form className="space-y-2" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const text = new FormData(form).get("comment");
          change(() => changeIdeaComment(roomId, id, "add", null, text), () => form.reset());
        }}>
          <Textarea name="comment" required maxLength={500} aria-label="댓글" />
          <Button size="sm" type="submit" disabled={pending}>댓글 등록</Button>
        </form>}
      </section>
    </>
  );
}
