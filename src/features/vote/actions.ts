"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { votes } from "@/mocks/db";
import type { VoteDetail } from "@/types/db";

const submitBallotSchema = z.object({
  roomId: z.number().int().positive(),
  voteId: z.number().int().positive(),
  optionIds: z.array(z.number().int().positive()).min(1),
});

/**
 * 투표 참여·선택 변경 — 명세 `PUT /api/v1/rooms/{roomId}/votes/{voteId}/ballots/me`.
 *
 * ⚠️ 이전 선택을 **덮어쓴다** (이력 없음). 서버 시각 기준 마감 이후 요청은 거절.
 * ⚠️ 목에선 서버 시각 체크를 흉내 내지 않는다 — 명세 외 안전망은 실서버에 맡긴다.
 */
export async function submitBallotAction(input: unknown): Promise<VoteDetail> {
  const { roomId, voteId, optionIds } = submitBallotSchema.parse(input);

  if (isMock) {
    const v = votes.find((x) => x.roomId === roomId && x.voteId === voteId);
    if (!v) throw new Error("투표를 찾을 수 없습니다.");
    if (v.status !== "OPEN") throw new Error("이미 마감된 투표입니다.");
    // 명세상 서버 시각 기준 마감 이후 요청은 거절. 목에서도 동일 가드.
    if (new Date(v.deadlineAt).getTime() <= Date.now()) {
      v.status = "CLOSED";
      v.closeReason = "DEADLINE";
      throw new Error("마감 시각이 지나 더 이상 참여할 수 없습니다.");
    }
    const validIds = new Set(v.options.map((o) => o.optionId));
    const cleaned = optionIds.filter((id) => validIds.has(id));
    if (cleaned.length === 0) throw new Error("유효한 선택지가 없습니다.");
    if (cleaned.length > v.maxSelectCount) {
      throw new Error(
        `선택은 최대 ${v.maxSelectCount}개까지 가능합니다.`,
      );
    }
    const wasParticipating = v.myOptionIds.length > 0;
    v.myOptionIds = cleaned;
    if (!wasParticipating) v.participantCount += 1;
    v.version += 1;

    revalidatePath(`/rooms/${roomId}/votes`, "page");
    const { roomId: _roomId, ...detail } = v;
    void _roomId;
    return detail;
  }

  const res = await api<VoteDetail>(
    `/api/v1/rooms/${roomId}/votes/${voteId}/ballots/me`,
    {
      method: "PUT",
      json: { optionIds },
    },
  );
  revalidatePath(`/rooms/${roomId}/votes`, "page");
  return res;
}
