import { FolderOpen, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FILE_TYPES, formatBytes } from "@/features/room-files/model";
import { RoomFileTable } from "@/features/room-files/RoomFileTable";
import { getRoomFileList } from "@/features/room-files/server";

export default async function RoomFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const keyword = typeof query.keyword === "string" ? query.keyword.trim().slice(0, 200) : "";
  const fileType =
    typeof query.fileType === "string" && Object.hasOwn(FILE_TYPES, query.fileType)
      ? query.fileType
      : "";
  const uploaderId =
    typeof query.uploaderId === "string" && /^[1-9]\d*$/.test(query.uploaderId)
      ? query.uploaderId
      : "";
  const page =
    typeof query.page === "string" && /^\d{1,9}$/.test(query.page) ? Number(query.page) : 0;

  const data = await getRoomFileList(roomId, { keyword, fileType, uploaderId, page });
  if (!data) notFound();

  const href = `/rooms/${roomId}/files`;
  const { usedBytes, limitBytes } = data.usage;
  const percent =
    usedBytes !== undefined && limitBytes && limitBytes > 0
      ? Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100))
      : null;
  const hasFilters = Boolean(keyword || fileType || uploaderId);
  const inputClass =
    "border-input bg-background focus-visible:ring-ring h-9 rounded-control border px-3 text-sm focus-visible:ring-2";
  const pageHref = (nextPage: number) =>
    `${href}?${new URLSearchParams({ keyword, fileType, uploaderId, page: String(nextPage) })}`;

  return (
    <section className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">파일</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            이 방에서 공유한 첨부 파일을 찾아보세요.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/rooms/${roomId}`}>대시보드로 돌아가기</Link>
        </Button>
      </header>

      <section aria-labelledby="room-storage" className="bg-card rounded-card border p-4">
        <div className="flex items-center gap-3">
          <div className="bg-secondary text-primary rounded-control p-2.5">
            <FolderOpen aria-hidden="true" className="size-5" />
          </div>
          <div className="flex-1">
            <h2 id="room-storage" className="text-sm font-semibold">
              방 저장 용량
            </h2>
            <p className="text-muted-foreground text-xs">
              {formatBytes(usedBytes)} / {formatBytes(limitBytes)} 사용 중
            </p>
          </div>
          {percent !== null && (
            <strong className="text-sm tabular-nums">
              {new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(percent)}%
            </strong>
          )}
        </div>
        {percent !== null && (
          <div
            role="progressbar"
            aria-labelledby="room-storage"
            aria-valuenow={percent}
            className="bg-secondary mt-3 h-1.5 overflow-hidden rounded-full"
          >
            <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
          </div>
        )}
        <p className="text-muted-foreground mt-2 text-xs">
          {percent === 100
            ? "저장 용량 한도에 도달해 파일을 추가로 첨부할 수 없어요."
            : "저장 용량 한도에 도달하면 파일을 추가로 첨부할 수 없어요."}
        </p>
      </section>

      <section aria-label="방 파일 목록" className="bg-card rounded-card overflow-hidden border">
        <form
          action={href}
          method="get"
          key={JSON.stringify([keyword, fileType, uploaderId])}
          className="flex flex-wrap items-center gap-2 border-b p-3"
        >
          <div className="relative min-w-48 flex-1 sm:flex-none">
            <Search
              aria-hidden="true"
              className="text-muted-foreground absolute top-2.5 left-3 size-4"
            />
            <Input
              type="search"
              name="keyword"
              aria-label="파일명 검색"
              placeholder="파일명 검색"
              defaultValue={keyword}
              maxLength={200}
              className="pl-9"
            />
          </div>
          <select
            name="fileType"
            aria-label="파일 유형"
            defaultValue={fileType}
            className={inputClass}
          >
            <option value="">모든 유형</option>
            {Object.entries(FILE_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="uploaderId"
            aria-label="업로더"
            defaultValue={uploaderId}
            className={inputClass}
          >
            <option value="">모든 업로더</option>
            {Array.from(data.uploaders, ([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
            {uploaderId && !data.uploaders.has(uploaderId) && (
              <option value={uploaderId}>선택한 업로더</option>
            )}
          </select>
          <Button type="submit" size="sm" variant="secondary">
            검색
          </Button>
          {hasFilters && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={href}>초기화</Link>
            </Button>
          )}
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            파일 {data.count.toLocaleString("ko-KR")}개
          </span>
        </form>
        {data.files.length ? (
          <RoomFileTable files={data.files} roomId={roomId} />
        ) : (
          <p className="text-muted-foreground px-4 py-14 text-center text-sm">
            {page > 0
              ? "이 페이지에 파일이 없어요."
              : hasFilters
                ? "검색 조건에 맞는 파일이 없어요."
                : "아직 공유한 파일이 없어요."}
          </p>
        )}
        {(page > 0 || data.hasNext) && (
          <nav
            aria-label="파일 페이지"
            className="flex items-center justify-center gap-3 border-t p-3"
          >
            {page > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page - 1)}>이전</Link>
              </Button>
            )}
            <span className="text-sm tabular-nums">{page + 1} 페이지</span>
            {data.hasNext && (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page + 1)}>다음</Link>
              </Button>
            )}
          </nav>
        )}
      </section>
    </section>
  );
}
