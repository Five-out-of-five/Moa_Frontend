"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { ApiError } from "@/lib/api";

import { dismissNotice } from "./server";

export async function dismissNoticeAction(noticeId: number) {
  if (!Number.isSafeInteger(noticeId) || noticeId < 1) return { error: "공지를 찾을 수 없어요." };
  try {
    await dismissNotice(noticeId);
    revalidatePath("/", "layout");
    return { error: null };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof ApiError ? error.message : "공지를 닫지 못했어요. 다시 시도해 주세요." };
  }
}
