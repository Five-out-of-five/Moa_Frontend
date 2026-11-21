import { Archive, Download, ExternalLink, FileText, ImageIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { FILE_TYPES, fileType, formatBytes, type RoomFile, sourceLabel } from "./model";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export function RoomFileTable({ files, roomId }: { files: RoomFile[]; roomId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs">
          <tr>
            {["파일명", "용량", "업로더", "업로드 일시", "출처", "받기"].map((label) => (
              <th key={label} scope="col" className="px-3 py-2.5 font-medium last:text-right">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {files.map((file) => {
            const type = fileType(file);
            const Icon = type === "IMAGE" ? ImageIcon : type === "ARCHIVE" ? Archive : FileText;
            const uploadedAt = new Date(file.uploadedAt ?? "");
            return (
              <tr key={file.fileId} className="hover:bg-muted/30">
                <th scope="row" className="px-3 py-3 font-medium">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-secondary text-primary rounded-control shrink-0 p-2">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="break-all">
                      {file.originalName}
                      <span className="text-muted-foreground block text-xs font-normal">
                        {FILE_TYPES[type]}
                      </span>
                    </span>
                  </div>
                </th>
                <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">
                  {formatBytes(file.sizeBytes)}
                </td>
                <td className="px-3 py-3">{file.uploader?.displayName ?? "—"}</td>
                <td className="text-muted-foreground px-3 py-3 whitespace-nowrap">
                  {Number.isFinite(uploadedAt.getTime()) ? (
                    <time dateTime={file.uploadedAt}>{dateFormat.format(uploadedAt)}</time>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs">
                      {sourceLabel(file.source)}
                    </span>
                    {file.sourceHref && (
                      <Link
                        href={file.sourceHref}
                        aria-label={`${file.originalName} 원본 위치로 이동`}
                        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        {file.sourceTitle ?? "원본 위치"}
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <Button variant="outline" size="icon" asChild>
                    <a
                      href={`/api/rooms/${roomId}/files/${file.fileId}/download`}
                      aria-label={`${file.originalName} 다운로드`}
                    >
                      <Download aria-hidden="true" className="size-4" />
                    </a>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
