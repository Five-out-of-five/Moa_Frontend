import type { components } from "@/types/api";

type Schemas = components["schemas"];
export type RoomFile = Omit<Schemas["RoomFileResponse"], "uploader"> & {
  fileId: number;
  originalName: string;
  uploader?: Pick<Schemas["MemberRef"], "accountId" | "displayName" | "memberStatus">;
  sourceHref?: string;
  sourceTitle?: string;
};
export type StorageUsage = Schemas["StorageUsageResponse"];
export const FILE_TYPES = {
  IMAGE: "이미지",
  DOCUMENT: "문서",
  ARCHIVE: "압축 파일",
} as const;
export const FILE_SOURCES = { CHAT: "채팅", IDEA_CARD: "아이디어 카드", TASK: "업무 카드" } as const;

export function fileType(file: RoomFile): keyof typeof FILE_TYPES | "OTHER" {
  if (/\.(png|jpe?g|gif|webp)$/i.test(file.originalName)) return "IMAGE";
  if (/\.(pdf|docx|xlsx|pptx|txt|md)$/i.test(file.originalName)) return "DOCUMENT";
  if (/\.zip$/i.test(file.originalName)) return "ARCHIVE";
  return "OTHER";
}

export function matchesFileType(file: RoomFile, filter: string) {
  return !filter || fileType(file) === filter;
}

export function uploaderLabel(uploader: RoomFile["uploader"]) {
  if (uploader?.memberStatus === "LEFT") return "나간 멤버";
  if (uploader?.memberStatus === "WITHDRAWN") return "탈퇴한 사용자";
  if (uploader?.memberStatus === "KICKED") return `${uploader.displayName ?? "멤버"} (내보냄)`;
  return uploader?.displayName ?? "—";
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
