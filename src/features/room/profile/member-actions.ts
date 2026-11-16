"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { getOrCreateMockDm } from "@/features/chat/server";

import { getRoomMemberProfile } from "./member-server";

export async function startRoomMemberDmAction(roomId: string, accountId: string) {
  const profile = await getRoomMemberProfile(roomId, accountId);
  if (!profile?.canStartDm) notFound();
  const thread = await getOrCreateMockDm(profile.accountId);
  if (!thread) notFound();
  revalidatePath("/", "layout");
  redirect(`/dms/${thread.id}`);
}
