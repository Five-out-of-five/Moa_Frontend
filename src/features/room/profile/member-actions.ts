"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { getOrCreateMockDm } from "@/features/chat/server";
import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

import { getRoomMemberProfile } from "./member-server";

export async function startRoomMemberDmAction(roomId: string, accountId: string): Promise<{ error: string }> {
  const profile = await getRoomMemberProfile(roomId, accountId);
  if (!profile?.canStartDm) notFound();
  if (!isMock) {
    let channel: components["schemas"]["ChannelResponse"];
    try {
      channel = await api(`/api/v1/rooms/${roomId}/direct-channels`, {
        method: "POST", json: { targetAccountId: profile.accountId }, cache: "no-store",
      });
    } catch (error) {
      if (error instanceof ApiError) return { error: error.message };
      throw error;
    }
    if (channel?.channelId == null) return { error: "개인 대화 채널 번호를 받지 못했습니다." };
    revalidatePath("/", "layout");
    redirect(`/rooms/${roomId}/channels/${channel.channelId}`);
  }
  const thread = await getOrCreateMockDm(profile.accountId);
  if (!thread) notFound();
  revalidatePath("/", "layout");
  redirect(`/dms/${thread.id}`);
}
