"use client";

import { Copy, Download, Share2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import type { TeamMoodMember } from "./model";
import { drawMoodImage, exportMoodImage } from "./share-image";

export function MoodShare({ roomName, date, members }: { roomName: string; date: string; members: TeamMoodMember[] }) {
  const [open, setOpen] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [retry, setRetry] = useState(0);
  const previewHost = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{
    members: TeamMoodMember[]; roomName: string; date: string; includeNotes: boolean;
    content: HTMLDivElement; retry: number;
    preview: { blob: Blob; url: string } | null;
  } | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const host = previewHost.current;
    if (!open || !content || !host) return;
    const colors = getComputedStyle(content);
    const input = { roomName, date, members, includeNotes, content, retry };
    let active = true;
    let url: string | undefined;
    try {
      const { canvas, previewAspectRatio } = drawMoodImage({ roomName, date, members, includeNotes, background: colors.backgroundColor, foreground: colors.color });
      // 미리보기는 그리기가 끝난 캔버스로 바로 교체하고, PNG 인코딩은 별도로 기다린다.
      host.style.aspectRatio = previewAspectRatio;
      host.replaceChildren(canvas);
      void exportMoodImage(canvas).then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setResult({ ...input, preview: { blob, url } });
      }).catch(() => { if (active) setResult({ ...input, preview: null }); });
    } catch {
      host.replaceChildren();
      setResult({ ...input, preview: null });
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [content, date, includeNotes, members, open, retry, roomName]);

  const current = open && result && result.members === members && result.roomName === roomName &&
    result.date === date && result.includeNotes === includeNotes && result.content === content &&
    result.retry === retry ? result : null;
  const ready = current?.preview;

  async function copy() {
    if (!ready) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": ready.blob })]);
      toast.success("공유 이미지를 복사했어요.");
    } catch {
      toast.error("이미지를 복사할 수 없어요. 이미지 저장을 이용해 주세요.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      setResult(null);
      if (!next) setIncludeNotes(false);
    }}>
      <DialogTrigger asChild><Button><Share2 aria-hidden="true" />공유하기</Button></DialogTrigger>
      <DialogContent ref={setContent} className="max-h-[90dvh] overflow-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>팀 상태 공유</DialogTitle>
          <DialogDescription>이미지를 미리 보고 저장하거나 복사할 수 있어요.</DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary size-4" checked={includeNotes} onChange={(event) => {
            setResult(null);
            setIncludeNotes(event.target.checked);
          }} />
          코멘트 포함
        </label>
        <div ref={previewHost} role="img" aria-label="팀 상태 공유 이미지 미리보기"
          className="border-border rounded-control box-content max-h-[48dvh] overflow-auto border [scrollbar-gutter:stable] empty:hidden [&>canvas]:block [&>canvas]:h-auto [&>canvas]:w-full" />
        {current && !ready && (
          <div role="alert" className="text-destructive flex flex-wrap items-center gap-2 text-sm">
            <p>공유 이미지를 만들지 못했어요.</p>
            <Button variant="outline" onClick={() => setRetry((count) => count + 1)}>다시 시도</Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={!ready} onClick={() => void copy()}><Copy aria-hidden="true" />복사</Button>
          {ready ? (
            <Button asChild><a href={ready.url} download={`팀-상태-${date}.png`}><Download aria-hidden="true" />이미지 저장</a></Button>
          ) : <Button disabled><Download aria-hidden="true" />이미지 저장</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
