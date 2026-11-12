import "server-only";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { votes } from "@/mocks/db";
import type { PageResponse, VoteDetail, VoteSummary } from "@/types/db";

function stripRoomId(v: VoteDetail & { roomId: number }): VoteDetail {
  const { roomId: _roomId, ...detail } = v;
  void _roomId;
  return detail;
}

/**
 * 방 안의 투표 목록 — 명세 `GET /api/v1/rooms/{roomId}/votes`,
 * `PageResponse<VoteSummaryResponse>`.
 *
 * ⚠️ 목에선 Detail 풀 shape 로 깔아 두고 여기서 Summary 로 축소한다
 *    (목록은 가벼운 shape, 상세는 풀 shape 로 명세가 설계).
 */
export async function listVotesInRoom(
  roomId: number,
): Promise<PageResponse<VoteSummary>> {
  if (isMock) {
    const inRoom = votes.filter((v) => v.roomId === roomId);
    const summaries: VoteSummary[] = inRoom.map((v) => ({
      voteId: v.voteId,
      title: v.title,
      voteType: v.voteType,
      status: v.status,
      deadlineAt: v.deadlineAt,
      participantCount: v.participantCount,
      memberCount: v.memberCount,
      votedByMe: v.myOptionIds.length > 0,
      sourceCardId: v.sourceCard?.cardId ?? null,
    }));
    return {
      content: summaries,
      page: 0,
      size: summaries.length,
      totalElements: summaries.length,
      totalPages: 1,
      hasNext: false,
    };
  }
  return api<PageResponse<VoteSummary>>(`/api/v1/rooms/${roomId}/votes`);
}

/**
 * 투표 상세 조회 — 명세 `GET /api/v1/rooms/{roomId}/votes/{voteId}`.
 * 진행 중이면 `options[].voteCount` 는 내려오지 않는다 (결과 공개 전).
 */
export async function getVoteDetail(
  roomId: number,
  voteId: number,
): Promise<VoteDetail | null> {
  if (isMock) {
    const v = votes.find((x) => x.roomId === roomId && x.voteId === voteId);
    if (!v) return null;
    // 목 저장소는 roomId 를 함께 들고 있지만 명세 Detail shape 에는 없어 분리한다.
    return stripRoomId(v);
  }
  return api<VoteDetail>(`/api/v1/rooms/${roomId}/votes/${voteId}`);
}
