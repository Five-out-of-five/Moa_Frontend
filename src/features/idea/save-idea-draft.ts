import { saveIdeaCard } from "./actions";
import { discardIdeaFile, stageIdeaFile } from "./file-actions";
import type { IdeaFormResult } from "./model";

const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type IdeaCardRetry = { roomId: number; sessionId: number; form: FormData; expiresAt: number };

export async function saveIdeaDraft(
  roomId: number, sessionId: number, cardId: number | null,
  previous: IdeaFormResult, form: FormData, retry: IdeaCardRetry | null,
): Promise<{ result: IdeaFormResult; retry: IdeaCardRetry | null }> {
  if (retry) {
    if (Date.now() >= retry.expiresAt) {
      return { result: { error: "재시도 시간이 지났어요. 저장된 카드가 있는지 보드에서 확인해 주세요." }, retry: null };
    }
    try {
      const result = await saveIdeaCard(retry.roomId, retry.sessionId, null, previous, retry.form);
      return { result, retry: result.outcomeUnknown ? retry : null };
    } catch {
      return { result: { error: "카드 저장 결과를 확인하지 못했어요." }, retry };
    }
  }

  const files = form.getAll("attachment").filter((file): file is File => file instanceof File && file.size > 0);
  form.delete("attachment");
  if (files.length > 5) return { result: { error: "파일은 최대 5개까지 첨부할 수 있어요." }, retry: null };

  const staged: number[] = [];
  let request: IdeaCardRetry | null = null;
  let keepFiles = false;
  try {
    for (const file of files) {
      const uploadData = new FormData();
      uploadData.set("file", file);
      const result = await stageIdeaFile(roomId, uploadData);
      if (!result.fileId) return { result: { error: result.error }, retry: null };
      staged.push(result.fileId);
      form.append("fileId", String(result.fileId));
    }
    if (cardId === null) {
      form.set("requestId", crypto.randomUUID());
      request = { roomId, sessionId, form, expiresAt: Date.now() + RETRY_WINDOW_MS };
    }
    const result = await saveIdeaCard(roomId, sessionId, cardId, previous, form);
    keepFiles = result.saved === true || result.outcomeUnknown === true;
    return { result, retry: result.outcomeUnknown ? request : null };
  } catch {
    keepFiles = request !== null;
    return { result: { error: "카드에 변경 사항을 저장하지 못했어요." }, retry: request };
  } finally {
    if (!keepFiles) await Promise.allSettled(staged.map((id) => discardIdeaFile(roomId, id)));
  }
}
