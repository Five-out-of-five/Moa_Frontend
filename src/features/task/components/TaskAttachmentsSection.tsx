"use client";

import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { TaskFileRef } from "@/types/db";

import {
  attachTaskFile,
  getTaskFileDownloadUrl,
  removeTaskFile,
} from "../attachment-actions";

interface Props {
  roomId: number;
  taskId: number;
  files: readonly TaskFileRef[];
  /** 수정 권한 — 작성자/담당자만 업로드/삭제 버튼을 노출. 보기만 필요하면 false 로 넘긴다. */
  canEdit: boolean;
}

/**
 * 업무 상세 Sheet 안의 **첨부 섹션**.
 *
 * ⚠️ 서버 액션으로 업로드·삭제·다운로드. presigned URL 은 `window.open` 으로 받아가게 둬서
 *    대용량 파일도 브라우저가 직접 처리하도록 한다 (서버를 거치지 않음).
 * ⚠️ 파일 크기·확장자 제한은 `uploadRoomFile` 공용 유틸이 선제 검증 (20MB · 지정 확장자).
 *    실패하면 action 응답의 `error` 로 사용자 메시지가 내려온다.
 */
export function TaskAttachmentsSection({ roomId, taskId, files, canEdit }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const handlePick = () => {
    if (pending) return;
    inputRef.current?.click();
  };

  const handleUpload = (file: File | null) => {
    if (!file) return;
    setError(null);
    const data = new FormData();
    data.set("file", file);
    startTransition(async () => {
      const result = await attachTaskFile(roomId, taskId, data);
      if ("error" in result && result.error) setError(result.error);
      // input value 를 초기화해 같은 파일 재선택도 트리거되도록.
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const handleDownload = (fileId: number) => {
    setError(null);
    setDownloadingId(fileId);
    startTransition(async () => {
      try {
        const result = await getTaskFileDownloadUrl(roomId, fileId);
        if ("url" in result) {
          window.open(result.url, "_blank", "noopener,noreferrer");
        } else if (result.error) {
          setError(result.error);
        }
      } finally {
        setDownloadingId(null);
      }
    });
  };

  const handleRemove = (fileId: number) => {
    if (!window.confirm("첨부 파일을 삭제할까요? 복구할 수 없어요.")) return;
    setError(null);
    setRemovingId(fileId);
    startTransition(async () => {
      try {
        const result = await removeTaskFile(roomId, taskId, fileId);
        if ("error" in result && result.error) setError(result.error);
      } finally {
        setRemovingId(null);
      }
    });
  };

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
          <Paperclip className="size-3.5" />
          첨부 · {files.length}
        </h3>
        {canEdit && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePick}
              disabled={pending}
              className="h-7 gap-1 px-2 text-xs"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              파일 추가
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
              disabled={pending}
            />
          </>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {canEdit ? "파일을 드래그하거나 ‘파일 추가’ 로 올려 보세요." : "첨부된 파일이 없어요."}
        </p>
      ) : (
        <ul className="border-border-soft divide-border-soft divide-y rounded-md border">
          {files.map((file) => (
            <li
              key={file.fileId}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatBytes(file.byteSize)}
                  {file.createdAt && ` · ${formatShortDate(file.createdAt)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(file.fileId)}
                  disabled={pending}
                  aria-label={`${file.name} 다운로드`}
                  className="h-7 w-7 p-0"
                >
                  {downloadingId === file.fileId ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                </Button>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(file.fileId)}
                    disabled={pending}
                    aria-label={`${file.name} 삭제`}
                    className="text-destructive hover:text-destructive h-7 w-7 p-0"
                  >
                    {removingId === file.fileId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-destructive mt-2 text-xs" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
