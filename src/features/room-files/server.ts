import "server-only";

import { unstable_rethrow } from "next/navigation";

import { getLiveIdeaBriefingTarget } from "@/features/idea/server";
import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { listRoomMembers } from "@/features/room/server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

import { listMockRoomFiles } from "./mock-data";
import { matchesFileType, type RoomFile, type StorageUsage, uploaderLabel } from "./model";

type Schemas = components["schemas"];
const PAGE_SIZE = 20;

export type FileQuery = { keyword: string; source: string; fileType: string; uploaderId: string; page: number };

function uploaderOptions(members: Schemas["MemberRef"][]) {
  const options = new Map<string, string>();
  for (const member of members) {
    if (member.accountId) options.set(String(member.accountId), uploaderLabel(member));
  }
  return new Map([...options].sort((a, b) => a[1].localeCompare(b[1], "ko")));
}

function isId(value: string) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

export async function getRoomFileList(roomId: string, filters: FileQuery) {
  const entry = await getFirstRoomProfile(roomId);
  if (!entry?.setup || entry.setup.needsSetup) return null;
  const id = entry.room.id;
  const start = filters.page * PAGE_SIZE;
  if (isMock) {
    const rows = listMockRoomFiles(id).map(({ file }) => file);
    const files = rows
      .filter(
        (file) =>
          file.originalName.toLowerCase().includes(filters.keyword.toLowerCase()) &&
          matchesFileType(file, filters.fileType) &&
          (!filters.source || file.source === filters.source) &&
          (!filters.uploaderId || String(file.uploader?.accountId) === filters.uploaderId),
      )
      .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
    return {
      files: files.slice(start, start + PAGE_SIZE),
      uploaders: uploaderOptions(rows.flatMap(({ uploader }) => (uploader ? [uploader] : []))),
      count: files.length,
      hasNext: files.length > start + PAGE_SIZE,
      usage: {
        usedBytes: rows.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0),
        limitBytes: 2 * 1024 ** 3,
      },
    };
  }

  const query = new URLSearchParams();
  query.set("page", String(filters.page));
  query.set("size", String(PAGE_SIZE));
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (filters.source) query.set("source", filters.source);
  if (filters.fileType) query.set("fileType", filters.fileType);
  if (filters.uploaderId) query.set("uploaderId", filters.uploaderId);

  const base = `/api/v1/rooms/${id}`;
  const init = { cache: "no-store" as const };
  const [page, usage, members] = await Promise.all([
    api<Schemas["PageResponseRoomFileResponse"]>(`${base}/files?${query}`, init),
    api<StorageUsage>(`${base}/storage-usage`, init),
    listRoomMembers(id),
  ]);
  const ideaIds = new Set((page.content ?? []).flatMap((file) => file.source === "IDEA_CARD" && file.sourceId ? [file.sourceId] : []));
  const ideaTargets = new Map(await Promise.all([...ideaIds].map(async (cardId) => {
    const idea = await getLiveIdeaBriefingTarget(id, cardId).catch((error: unknown) => {
      unstable_rethrow(error);
      return null;
    });
    return [cardId, idea && `${idea.href}${idea.href.includes("?") ? "&" : "?"}briefingFocus=${cardId}`] as const;
  })));
  const files: RoomFile[] = (page.content ?? []).flatMap((file) => {
    if (!file.fileId || !file.originalName) return [];
    const root = `/rooms/${roomId}`;
    const sourceHref =
      file.sourceId && file.source === "TASK"
        ? `${root}/boards/task?open=${file.sourceId}`
        : file.sourceId && file.source === "IDEA_CARD"
          ? ideaTargets.get(file.sourceId) ?? undefined
          : undefined;
    return [{ ...file, fileId: file.fileId, originalName: file.originalName, sourceHref }];
  });
  const uploaders = uploaderOptions([
    ...members,
    ...files.flatMap(({ uploader }) => (uploader ? [uploader] : [])),
  ]);
  return {
    files,
    uploaders,
    count: page.totalElements ?? files.length,
    hasNext: page.hasNext ?? page.last === false,
    usage,
  };
}

export async function downloadRoomFile(roomId: string, fileId: string): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  const missingFile = () => new Response("파일을 찾을 수 없어요.", { status: 404, headers });
  try {
    if (!isId(roomId) || !isId(fileId)) return missingFile();
    if (isMock) {
      const entry = await getFirstRoomProfile(roomId);
      if (!entry?.setup || entry.setup.needsSetup) return missingFile();
      const row = listMockRoomFiles(entry.room.id).find(
        ({ file }) => String(file.fileId) === fileId,
      );
      if (!row) return missingFile();
      return new Response(new Uint8Array(row.body), {
        headers: {
          ...headers,
          "Content-Type": row.file.mimeType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.file.originalName)}`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const { url } = await api<Schemas["DownloadUrlResponse"]>(
      `/api/v1/rooms/${roomId}/files/${fileId}/download-url`,
      { cache: "no-store", allowAuthRefresh: true },
    );
    const destination = new URL(url ?? "");
    if (destination.protocol !== "https:") throw new Error("다운로드 주소를 확인할 수 없어요.");
    return new Response(null, {
      status: 302,
      headers: { ...headers, Location: destination.href, "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      return missingFile();
    }
    return new Response("파일을 다운로드할 수 없어요. 다시 시도해 주세요.", { status: 502, headers });
  }
}
