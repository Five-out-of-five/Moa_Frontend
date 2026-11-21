import "server-only";

import { cookies } from "next/headers";

import { getFirstRoomProfile } from "@/features/room/first-profile/server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

import { listMockRoomFiles } from "./mock-data";
import { fileType, type RoomFile, sourceLabel, type StorageUsage } from "./model";

type Schemas = components["schemas"];
const PAGE_SIZE = 20;

export type FileQuery = { keyword: string; fileType: string; uploaderId: string; page: number };

function uploaderOptions(members: Schemas["MemberRef"][]) {
  const options = new Map<string, string>();
  for (const { accountId, displayName } of members) {
    if (accountId) options.set(String(accountId), displayName ?? `사용자 ${accountId}`);
  }
  return new Map([...options].sort((a, b) => a[1].localeCompare(b[1], "ko")));
}

async function getSession(roomId: string) {
  const entry = await getFirstRoomProfile(roomId);
  if (!entry || entry.setup?.needsSetup) return null;
  if (isMock) return { roomId: entry.room.id, query: "", accessToken: undefined };

  const cookieName = process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME || "accessToken";
  const accessToken = (await cookies()).get(cookieName)?.value;
  if (!accessToken) return null;
  const account = await api<Schemas["MyAccountResponse"]>("/api/v1/accounts/me", {
    accessToken,
    cache: "no-store",
  });
  const accountId = account.accountId;
  if (!accountId) throw new Error("계정 정보를 확인할 수 없어요.");
  return { roomId: entry.room.id, query: `accountId=${accountId}`, accessToken };
}

export async function getRoomFileList(roomId: string, filters: FileQuery) {
  const session = await getSession(roomId);
  if (!session) return null;
  const start = filters.page * PAGE_SIZE;
  if (isMock) {
    const rows = listMockRoomFiles(session.roomId).map(({ file }) => file);
    const files = rows
      .filter(
        (file) =>
          file.originalName.toLowerCase().includes(filters.keyword.toLowerCase()) &&
          (!filters.fileType || fileType(file) === filters.fileType) &&
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

  const query = new URLSearchParams(session.query);
  query.set("page", String(filters.page));
  query.set("size", String(PAGE_SIZE));
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (filters.fileType) query.set("fileType", filters.fileType);
  if (filters.uploaderId) query.set("uploaderId", filters.uploaderId);

  const base = `/api/v1/rooms/${session.roomId}`;
  const init = { accessToken: session.accessToken, cache: "no-store" as const };
  const [page, usage, members] = await Promise.all([
    api<Schemas["PageResponseRoomFileResponse"]>(`${base}/files?${query}`, init),
    api<StorageUsage>(`${base}/storage-usage?${session.query}`, init),
    api<Schemas["MemberResponse"][]>(`${base}/members?${session.query}`, init),
  ]);
  const files: RoomFile[] = (page.content ?? []).flatMap((file) => {
    if (!file.fileId || !file.originalName) return [];
    const label = sourceLabel(file.source);
    const root = `/rooms/${roomId}`;
    const sourceHref =
      file.sourceId && label === "업무 카드"
        ? `${root}/boards/task?open=${file.sourceId}`
        : file.sourceId && label === "아이디어 카드"
          ? `${root}/boards/idea?briefingFocus=${file.sourceId}`
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
  try {
    const session = await getSession(roomId);
    if (!session || !/^[1-9]\d*$/.test(fileId))
      return new Response("파일을 찾을 수 없어요.", { status: 404 });
    const headers = { "Cache-Control": "private, no-store" };
    if (isMock) {
      const row = listMockRoomFiles(session.roomId).find(
        ({ file }) => String(file.fileId) === fileId,
      );
      if (!row) return new Response("파일을 찾을 수 없어요.", { status: 404, headers });
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
      `/api/v1/rooms/${session.roomId}/files/${fileId}/download-url?${session.query}`,
      { accessToken: session.accessToken, cache: "no-store" },
    );
    const destination = new URL(url ?? "");
    if (destination.protocol !== "https:") throw new Error("다운로드 주소를 확인할 수 없어요.");
    return new Response(null, {
      status: 303,
      headers: { ...headers, Location: destination.href, "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      return new Response("파일을 찾을 수 없어요.", { status: 404 });
    }
    return new Response("파일을 다운로드할 수 없어요. 다시 시도해 주세요.", { status: 502 });
  }
}
