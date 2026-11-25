"use server";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { isRoomId } from "@/features/room/management/api-server";
import { getManagedRoom } from "@/features/room/management/server";
import { ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { ideaCards } from "@/mocks/db";

import { ideaApi } from "./api-board";
import type { IdeaMoveResult } from "./model";
import { refreshIdeaBoard } from "./server";

const positionSchema = z.object({
  cardType: z.enum(["AGENDA", "KEEP", "PROBLEM", "TRY"]),
  toIndex: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
});

const movedCardSchema = z.object({
  cardId: z.number().int().positive(),
  cardType: z.enum(["AGENDA", "KEEP", "PROBLEM", "TRY"]),
  sortOrder: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  title: z.string().optional(),
  content: z.string().nullable().optional(),
}).transform(({ cardId, ...card }) => ({ id: cardId, ...card }));

export async function moveIdeaCard(roomId: number, cardId: number, input: unknown): Promise<IdeaMoveResult> {
  const placement = positionSchema.safeParse(input);
  if (!isRoomId(roomId) || !isRoomId(cardId) || !placement.success) return { error: "카드 위치를 확인해 주세요." };
  if (!isMock) {
    try {
      const response = await ideaApi<unknown>(roomId, `/idea-cards/${cardId}/position`, { method: "PATCH", json: placement.data });
      const cards = z.array(movedCardSchema).safeParse(response);
      return { ...refreshIdeaBoard(roomId), cards: cards.data };
    } catch (error) {
      unstable_rethrow(error);
      if (!(error instanceof ApiError)) return { error: "카드를 이동하지 못했어요." };
      const latest = error.code === "CARD_VERSION_CONFLICT" ? movedCardSchema.safeParse(error.data).data : undefined;
      return { error: error.message, cards: latest ? [latest] : undefined };
    }
  }
  if (!(await getManagedRoom(roomId))) return { error: "이 방의 카드를 이동할 수 없어요." };
  const card = ideaCards.find(({ id, roomId: room }) => id === cardId && room === roomId);
  if (!card) return { error: "카드를 찾을 수 없어요." };
  const { cardType, toIndex } = placement.data;
  const column = (type: typeof cardType) => ideaCards.filter((item) =>
    item.roomId === roomId && item.sessionId === card.sessionId && item.cardType === type && item.id !== cardId,
  ).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const previous = card.cardType;
  const destination = column(cardType);
  destination.splice(toIndex, 0, card);
  card.cardType = cardType;
  destination.forEach((item, index) => { item.sortOrder = index; });
  if (previous !== cardType) column(previous).forEach((item, index) => { item.sortOrder = index; });
  return refreshIdeaBoard(roomId);
}
