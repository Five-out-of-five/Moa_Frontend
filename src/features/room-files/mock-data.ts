import { CHANNEL_MESSAGES, CHAT_CHANNELS } from "@/features/chat/mock-seed";
import { boardSessions, ideaCards, tasks } from "@/mocks/db";

import type { RoomFile } from "./model";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=";

export function listMockRoomFiles(roomId: number) {
  const rows: { file: RoomFile; body: Buffer }[] = [];
  if (roomId !== 1) return rows;
  const base = `/rooms/${roomId}`;
  const channel = CHAT_CHANNELS.find(
    ({ id, roomId: scope, kind }) => id === 102 && scope === roomId && kind === "PUBLIC",
  );
  const message = channel && CHANNEL_MESSAGES[channel.id]?.find(({ id }) => id === 10203);
  const idea = ideaCards.find(({ id, roomId: scope }) => id === 1 && scope === roomId);
  const session = idea && boardSessions.find(({ id }) => id === idea.sessionId);
  const task = tasks.find(({ taskId, roomId: scope }) => taskId === 1 && scope === roomId);

  const add = (file: RoomFile, body: Buffer) =>
    rows.push({ file: { ...file, sizeBytes: body.byteLength }, body });
  if (channel && message)
    add(
      {
        fileId: 1,
        originalName: "온보딩-시안.png",
        mimeType: "image/png",
        uploader: message.author,
        uploadedAt: message.createdAt,
        source: "CHAT",
        sourceId: message.id,
        sourceTitle: `# ${channel.name}`,
        sourceHref: `${base}/channels/${channel.id}?briefingFocus=${message.id}`,
      },
      Buffer.from(PNG, "base64"),
    );
  if (idea && session)
    add(
      {
        fileId: 2,
        originalName: "회고-안건.md",
        mimeType: "text/markdown",
        uploader: idea.author,
        uploadedAt: idea.createdAt,
        source: "IDEA_CARD",
        sourceId: idea.id,
        sourceTitle: idea.title,
        sourceHref: `${base}/boards/idea?${session.state === "CLOSED" ? `session=${session.id}&` : ""}briefingFocus=${idea.id}`,
      },
      Buffer.from(`# ${idea.title}\n\n${idea.content}\n`),
    );
  if (task)
    add(
      {
        fileId: 3,
        originalName: "회의록.txt",
        mimeType: "text/plain",
        uploader: task.registrant,
        uploadedAt: task.createdAt,
        source: "TASK",
        sourceId: task.taskId,
        sourceTitle: task.title,
        sourceHref: `${base}/boards/task?open=${task.taskId}`,
      },
      Buffer.from(`${task.title}\n\n${task.description}\n`),
    );
  return rows;
}
