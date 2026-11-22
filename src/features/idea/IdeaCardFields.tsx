"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToneReview } from "@/features/tone/ToneReview";
import type { IdeaCard } from "@/types/db";

export function IdeaCardFields({
  roomId,
  sessionId,
  card,
}: {
  roomId: number;
  sessionId: number;
  card?: IdeaCard;
}) {
  const [title, setTitle] = useState(card?.title ?? "");
  const fieldId = useId();
  const [content, setContent] = useState(card?.content ?? "");
  const target = { kind: "CARD" as const, roomId, sessionId, cardId: card?.id };
  return (
    <>
      <div className="space-y-2 text-sm font-medium">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${fieldId}-title`}>제목</label>
          <ToneReview target={target} value={title} onApply={setTitle} maxLength={100} label="제목 검토하기" />
        </div>
        <Input
          name="title"
          id={`${fieldId}-title`}
          required
          maxLength={100}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="아이디어 제목을 입력하세요."
        />
      </div>
      <div className="space-y-2 text-sm font-medium">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${fieldId}-content`}>내용</label>
          <ToneReview target={target} value={content} onApply={setContent} maxLength={1000} label="내용 검토하기" />
        </div>
        <Textarea
          name="content"
          id={`${fieldId}-content`}
          rows={4}
          maxLength={1000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="배경이나 제안 내용을 간단히 적어 주세요."
        />
      </div>
    </>
  );
}
