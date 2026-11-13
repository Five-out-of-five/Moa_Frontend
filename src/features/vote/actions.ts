"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { accounts, roomMembers, votes } from "@/mocks/db";
import type { MemberRef, VoteDetail, VoteType } from "@/types/db";

const submitBallotSchema = z.object({
  roomId: z.number().int().positive(),
  voteId: z.number().int().positive(),
  optionIds: z.array(z.number().int().positive()).min(1),
});

/**
 * 새 투표 생성 입력 — Figma Make 의 생성 다이얼로그가 보내는 shape.
 *
 * ⚠️ `YES_NO` 는 "찬성/반대" 두 선택지가 **서버에서 고정**이라 클라이언트가 보낸
 *    options 는 무시된다 (BE 명세에도 동일). `MULTIPLE` 만 `maxSelectCount` 를
 *    씀. `SINGLE` / `YES_NO` 는 저장 전에 1 로 정규화한다.
 * ⚠️ `deadlineAt` 은 ISO-8601 (브라우저 로컬 → `toISOString()`). 서버 시각 기준
 *    "미래" 여야 하고, 30일 뒤까지만 허용 — 영원히 열어두는 투표는 UX 실수에
 *    가까워 BE 가 400 을 돌려줄 때 FE 가 먼저 막는다.
 */
const createVoteSchema = z
  .object({
    roomId: z.number().int().positive(),
    title: z
      .string()
      .trim()
      .min(1, "투표 제목을 입력해 주세요.")
      .max(120, "투표 제목은 120자 이하로 입력해 주세요."),
    voteType: z.enum(["SINGLE", "MULTIPLE", "YES_NO"] as const satisfies readonly VoteType[]),
    options: z
      .array(z.string().trim().min(1).max(60))
      .max(10, "선택지는 최대 10개까지 등록할 수 있어요."),
    maxSelectCount: z.number().int().min(1).max(10),
    deadlineAt: z.string().datetime({ offset: true }),
    anonymous: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.voteType !== "YES_NO" && v.options.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "선택지는 2개 이상 입력해 주세요.",
      });
    }
    if (v.voteType === "MULTIPLE" && v.maxSelectCount > v.options.length) {
      ctx.addIssue({
        code: "custom",
        path: ["maxSelectCount"],
        message: "최대 선택 수는 선택지 수를 넘을 수 없어요.",
      });
    }
    const dueMs = Date.parse(v.deadlineAt);
    if (!Number.isFinite(dueMs)) {
      ctx.addIssue({
        code: "custom",
        path: ["deadlineAt"],
        message: "마감 일시가 올바르지 않습니다.",
      });
      return;
    }
    if (dueMs <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["deadlineAt"],
        message: "마감 일시는 현재 이후로 설정해 주세요.",
      });
    }
    if (dueMs - Date.now() > 30 * 24 * 60 * 60 * 1000) {
      ctx.addIssue({
        code: "custom",
        path: ["deadlineAt"],
        message: "마감 일시는 30일 이내로 설정해 주세요.",
      });
    }
  });

/**
 * 투표 생성 결과 — 참여 액션과 같이 **throw 하지 않고 kind 로 구분해서 리턴**한다.
 * - `ok` : 생성 성공, `vote` 신규 상세 (상세 Sheet 자동 오픈용)
 * - `error` : 검증 실패 or 서버 거절 — `message` 를 폼 하단에 그대로 띄우면 된다
 *   (`fieldErrors` 는 zod 가 잡은 필드 단위 메시지, 있을 때만 전달)
 */
export type CreateVoteResult =
  | { kind: "ok"; vote: VoteDetail }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * 새 투표 생성 — 명세 `POST /api/v1/rooms/{roomId}/votes` → `VoteDetailResponse`.
 *
 * 목 모드에선 `mocks/db.ts` 저장소 끝에 push 하고, 생성자는 홍근 (accounts[0]) 로 가정.
 * `YES_NO` 는 선택지 "찬성"/"반대" 를 서버에서 자동으로 깔아 준다 (BE 명세).
 */
export async function createVoteAction(
  input: unknown,
): Promise<CreateVoteResult> {
  const parsed = createVoteSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors,
    };
  }
  const { roomId, title, voteType, options, maxSelectCount, deadlineAt, anonymous } =
    parsed.data;

  // YES_NO 는 선택지를 서버가 고정으로 깔고 maxSelectCount 도 1 로 강제.
  const normalizedOptions =
    voteType === "YES_NO" ? ["찬성", "반대"] : options;
  const normalizedMax = voteType === "MULTIPLE" ? maxSelectCount : 1;

  if (isMock) {
    const me = accounts[0];
    if (!me) {
      return { kind: "error", message: "현재 계정을 확인하지 못했습니다." };
    }
    // 방 멤버가 아니면 생성 금지 (BE 가 403 을 돌려줄 케이스를 FE 에서 먼저 반사).
    const belongs = roomMembers.some(
      (m) => m.roomId === roomId && m.accountId === me.id && m.state === "ACTIVE",
    );
    if (!belongs) {
      return { kind: "error", message: "이 방의 멤버만 투표를 만들 수 있어요." };
    }
    const memberCount = roomMembers.filter(
      (m) => m.roomId === roomId && m.state === "ACTIVE",
    ).length;
    const creator: MemberRef = {
      accountId: me.id,
      displayName: me.name,
      profileImageUrl: null,
      memberStatus: "ACTIVE",
    };
    const newVoteId = nextMockId(votes.map((v) => v.voteId));
    const existingOptionIds = votes.flatMap((v) => v.options.map((o) => o.optionId));
    let nextOptId = nextMockId(existingOptionIds);
    const detail: VoteDetail = {
      voteId: newVoteId,
      title,
      voteType,
      maxSelectCount: normalizedMax,
      anonymous,
      status: "OPEN",
      deadlineAt,
      closeReason: null,
      creator,
      sourceCard: null,
      parentVoteId: null,
      version: 1,
      participantCount: 0,
      memberCount,
      // 익명이든 아니든 생성 직후엔 참여자가 0 이라 둘 다 빈 배열.
      participants: [],
      myOptionIds: [],
      options: normalizedOptions.map((content) => ({
        optionId: nextOptId++,
        content,
      })),
      tied: false,
    };
    votes.push({ ...detail, roomId });
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: detail };
  }

  try {
    const res = await api<VoteDetail>(`/api/v1/rooms/${roomId}/votes`, {
      method: "POST",
      json: {
        title,
        voteType,
        options: normalizedOptions,
        maxSelectCount: normalizedMax,
        deadlineAt,
        anonymous,
      },
    });
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: res };
  } catch (e) {
    if (e instanceof ApiError) {
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: "투표 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
}

/**
 * 목 저장소의 다음 사용 가능한 id. seq 발급기 (`mocks/db.ts`) 를 공유하지 않고
 * 기존 최대값 +1 을 쓰는 이유: 액션 모듈에서 seq 를 import 하면 순환 참조가 생기고,
 * 새 투표/옵션 id 는 단조 증가만 유지되면 충분하기 때문.
 */
function nextMockId(existing: readonly number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

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
