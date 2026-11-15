"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";

import { appendMockDirectMessage, getDirectConversation } from "./server";

export async function sendDirectMessageAction(roomId: string, accountId: string, data: FormData) {
  const conversation = await getDirectConversation(roomId, accountId);
  if (!conversation) notFound();
  const message = z.string().trim().min(1).max(1000).safeParse(data.get("message"));
  if (!message.success) return;
  appendMockDirectMessage(conversation.key, message.data);
  revalidatePath(`/rooms/${roomId}/dms/${accountId}`);
}
