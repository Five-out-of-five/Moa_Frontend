"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { votes } from "@/mocks/db";
import type { VoteDetail } from "@/types/db";

const submitBallotSchema = z.object({
  roomId: z.number().int().positive(),
  voteId: z.number().int().positive(),
  optionIds: z.array(z.number().int().positive()).min(1),
});

/**
 * 투표 참여 결과 — **에러를 throw 하지 않고 kind 로 구분해서 리턴**한다 (task 와 같은 패턴).
 *
 * - `ok` : 정상 참여, `vote` 최신 상세
 * - `closed` : 이미/방금 마감된 상태로 반영됨. `vote` 로 CLOSED 상태 전달 → UI 가 입력
 *   비활성화 + 결과 표시로 전환하도록 사용한다
 * - `error` : 그 외 실패 (유효 선택지 아님, 네트워크 등)
 */
export type SubmitBallotResult =
  | { kind: "ok"; vote: VoteDetail }
  | { kind: "closed"; vote: VoteDetail; message: string }
  | { kind: "error"; message: string };

const CLOSED_MSG = "마감 시각이 지나 더 이상 참여할 수 없습니다.";

/**
 * 투표 참여·선택 변경 — 명세 `PUT /api/v1/rooms/{roomId}/votes/{voteId}/ballots/me`.
 *
 * ⚠️ 이전 선택을 **덮어쓴다** (이력 없음). 서버 시각 기준 마감 이후 요청은 거절.
 * ⚠️ 목 모드에서도 `deadlineAt` 을 검사해 지났으면 CLOSED 로 전환 + `revalidatePath` 하고
 *    `closed` kind 로 돌려줘, Sheet 가 바로 결과 상태로 바뀌도록 한다 (CodeRabbit).
 */
export async function submitBallotAction(
  input: unknown,
): Promise<SubmitBallotResult> {
  let parsed: z.infer<typeof submitBallotSchema>;
  try {
    parsed = submitBallotSchema.parse(input);
  } catch {
    return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  }
  const { roomId, voteId, optionIds } = parsed;

  if (isMock) {
    const v = votes.find((x) => x.roomId === roomId && x.voteId === voteId);
    if (!v) {
      return { kind: "error", message: "투표를 찾을 수 없습니다." };
    }
    const stripRoom = (): VoteDetail => {
      const { roomId: _r, ...detail } = v;
      void _r;
      return detail;
    };
    // 이미 마감된 상태
    if (v.status !== "OPEN") {
      return { kind: "closed", vote: stripRoom(), message: "이미 마감된 투표입니다." };
    }
    // 서버 시각 기준 마감 지남 — CLOSED 로 전환하고 리스트도 재검증
    if (new Date(v.deadlineAt).getTime() <= Date.now()) {
      v.status = "CLOSED";
      v.closeReason = "DEADLINE";
      revalidatePath(`/rooms/${roomId}/votes`, "page");
      return { kind: "closed", vote: stripRoom(), message: CLOSED_MSG };
    }
    const validIds = new Set(v.options.map((o) => o.optionId));
    const cleaned = optionIds.filter((id) => validIds.has(id));
    if (cleaned.length === 0) {
      return { kind: "error", message: "유효한 선택지가 없습니다." };
    }
    if (cleaned.length > v.maxSelectCount) {
      return {
        kind: "error",
        message: `선택은 최대 ${v.maxSelectCount}개까지 가능합니다.`,
      };
    }
    const wasParticipating = v.myOptionIds.length > 0;
    v.myOptionIds = cleaned;
    if (!wasParticipating) v.participantCount += 1;
    v.version += 1;

    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: stripRoom() };
  }

  try {
    const res = await api<VoteDetail>(
      `/api/v1/rooms/${roomId}/votes/${voteId}/ballots/me`,
      {
        method: "PUT",
        json: { optionIds },
      },
    );
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    if (res.status === "CLOSED") {
      // 서버가 마감된 결과를 돌려주면 UI 도 CLOSED 로 전환.
      return { kind: "closed", vote: res, message: CLOSED_MSG };
    }
    return { kind: "ok", vote: res };
  } catch (e) {
    if (e instanceof ApiError) {
      // 400/409 류의 메시지는 BE 가 한국어로 돌려준다 (명세).
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: "투표 제출에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
}
