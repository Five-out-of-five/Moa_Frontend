import type { components } from "@/types/api";

type Schemas = components["schemas"];
export type RoomFile = Omit<Schemas["RoomFileResponse"], "uploader"> & {
  fileId: number;
  originalName: string;
  uploader?: Pick<Schemas["MemberRef"], "accountId" | "displayName">;
  sourceHref?: string;
  sourceTitle?: string;
};
export type StorageUsage = Schemas["StorageUsageResponse"];
export const FILE_TYPES = {
  IMAGE: "이미지",
  DOCUMENT: "문서",
  ARCHIVE: "압축 파일",
  OTHER: "기타",
} as const;

export function fileType(file: RoomFile): keyof typeof FILE_TYPES {
  if (file.mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.originalName))
    return "IMAGE";
  if (/\.(pdf|docx|xlsx|pptx|txt|md)$/i.test(file.originalName)) return "DOCUMENT";
  if (/\.zip$/i.test(file.originalName)) return "ARCHIVE";
  return "OTHER";
}

export function sourceLabel(source?: string) {
  switch (source) {
    case "CHAT_ATTACHMENT":
    case "CHAT":
    case "MESSAGE":
      return "채팅";
    case "CARD_ATTACHMENT":
    case "CARD":
    case "IDEA_CARD":
      return "아이디어 카드";
    case "TASK_ATTACHMENT":
    case "TASK":
      return "업무 카드";
    default:
      return "—";
  }
}

export function formatBytes(bytes?: number) {
  if (bytes === undefined) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = bytes > 0 ? Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))) : 0;
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(bytes / 1024 ** index)} ${units[index]}`;
}
