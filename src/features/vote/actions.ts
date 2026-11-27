"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { isMock } from "@/mocks/config";
import { accounts, ideaCards, roomMembers, votes } from "@/mocks/db";
import type { MemberRef, VoteDetail, VoteType } from "@/types/db";

const submitBallotSchema = z.object({
  roomId: z.number().int().positive(),
  voteId: z.number().int().positive(),
  optionIds: z.array(z.number().int().positive()).min(1),
});

/**
 * 투표 수정 입력 — 현재 범위는 **제목 · 마감 일시 · 익명 여부** 세 가지.
 *
 * ⚠️ 선택지(options) 는 이번 PR 에서 수정하지 않는다 — 참여가 이미 들어온 투표에서
 *    선택지를 바꾸면 집계 공정성 문제가 생기고, 복원도 어렵다. BE 확정 뒤 별도 PR.
 */
// ⚠️ BE `VoteUpdateRequest` 는 낙관적 잠금용 `version` 을 필수로 요구한다 — 상세 조회로
//    받아온 현재 버전을 그대로 되돌려줘야 한다. `anonymous` 는 BE 가 받지 않으므로 제거.
const updateVoteSchema = z.object({
  roomId: z.number().int().positive(),
  voteId: z.number().int().positive(),
  version: z.number().int().nonnegative(),
  title: z
    .string()
    .trim()
    .min(1, "투표 제목을 입력해 주세요.")
    .max(120, "투표 제목은 120자 이하로 입력해 주세요."),
  deadlineAt: z.string().datetime({ offset: true }),
  anonymous: z.boolean(),
});

const idOnlySchema = z.object({
  roomId: z.number().int().positive(),
  voteId: z.number().int().positive(),
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
    // 아이디어 카드 → 투표 전환 시 전달. UI 호출부가 아직 미구현이라 선택적이지만,
    // BE 와의 schema 는 지금 맞춰 둬서 전환 UI 작업 때 추가 교정이 없도록.
    sourceCardId: z.number().int().positive().optional(),
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
  const { roomId, title, voteType, options, maxSelectCount, deadlineAt, anonymous, sourceCardId } =
    parsed.data;

  // YES_NO 는 선택지를 서버가 고정으로 깔고 maxSelectCount 도 1 로 강제.
  const normalizedOptions =
    voteType === "YES_NO" ? ["찬성", "반대"] : options;
  const normalizedMax = voteType === "MULTIPLE" ? maxSelectCount : 1;

  if (isMock) {
    const source = sourceCardId === undefined ? undefined : ideaCards.find(({ id, roomId: room, cardType }) =>
      id === sourceCardId && room === roomId && cardType === "AGENDA",
    );
    if (sourceCardId !== undefined && (!source || source.linkedVote)) {
      return { kind: "error", message: "투표에 연결할 안건 카드를 확인해 주세요." };
    }
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
      sourceCard: source ? { cardId: source.id, title: source.title } : null,
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
    votes.push({ ...detail, roomId, createdAt: new Date().toISOString() });
    if (source) {
      source.linkedVote = { id: newVoteId, status: "OPEN" };
      revalidatePath(`/rooms/${roomId}/boards/idea`);
    }
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
        ...(sourceCardId !== undefined && { sourceCardId }),
      },
    });
    if (sourceCardId !== undefined) revalidatePath(`/rooms/${roomId}/boards/idea`);
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
 * 투표 수정 결과 — 생성·참여 액션과 같이 kind 리턴 패턴.
 * - `ok` : 수정 성공, `vote` 최신 상세
 * - `conflict` : BE 낙관적 잠금 충돌 (version 불일치) — UI 는 안내 + 상세 재조회
 * - `error` : 검증 실패 or 서버 거절 (403 작성자 아님 등)
 */
export type UpdateVoteResult =
  | { kind: "ok"; vote: VoteDetail }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * 투표 수정 — 명세 `PATCH /api/v1/rooms/{roomId}/votes/{voteId}`.
 * 제목 · 마감 일시 · 익명 여부만 교체. 선택지 수정은 범위 외.
 */
export async function updateVoteAction(
  input: unknown,
): Promise<UpdateVoteResult> {
  const parsed = updateVoteSchema.safeParse(input);
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
  const { roomId, voteId, version, title, deadlineAt, anonymous } = parsed.data;

  if (isMock) {
    const v = votes.find((x) => x.roomId === roomId && x.voteId === voteId);
    if (!v) return { kind: "error", message: "투표를 찾을 수 없습니다." };
    if (v.status === "CLOSED") {
      return { kind: "error", message: "마감된 투표는 수정할 수 없어요." };
    }
    const me = accounts[0];
    if (!me || v.creator.accountId !== me.id) {
      return { kind: "error", message: "투표 작성자만 수정할 수 있어요." };
    }
    v.title = title;
    v.deadlineAt = deadlineAt;
    // 이미 참여한 사람의 신원을 숨기기 위해 참여자 → 익명 전환 시 participants 를 비운다.
    if (!v.anonymous && anonymous) v.participants = [];
    v.anonymous = anonymous;
    v.version += 1;
    const { roomId: _r, ...detail } = v;
    void _r;
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: detail };
  }

  // ⚠️ BE 는 `anonymous` 를 받지 않는다 (VoteUpdateRequest 에 없음). 익명 토글은 mock 환경
  //    전용 UX 이고, 실 API 전환 시에는 "익명 여부 수정" 자체를 BE 가 지원해야 한다.
  try {
    const res = await api<VoteDetail>(
      `/api/v1/rooms/${roomId}/votes/${voteId}`,
      { method: "PATCH", json: { title, deadlineAt, version } },
    );
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: res };
  } catch (e) {
    if (e instanceof ApiError) {
      // 409 는 BE 가 낙관적 잠금 충돌 (version 불일치) 때 돌리는 상태 코드.
      // 일반 오류와 구분해 UI 가 최신 상세를 재조회하고 version 을 갱신하도록 유도한다.
      if (e.status === 409) {
        return {
          kind: "conflict",
          message: "다른 사용자가 먼저 수정했어요. 최신 내용을 불러온 뒤 다시 저장해 주세요.",
        };
      }
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: "투표 수정에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
}

/**
 * 투표 수동 마감 결과 — kind 리턴 패턴.
 * - `ok` : 마감 완료, `vote` 최신 상세 (status=CLOSED, closeReason=MANUAL)
 * - `error` : 실패
 */
export type CloseVoteResult =
  | { kind: "ok"; vote: VoteDetail }
  | { kind: "error"; message: string };

/**
 * 투표 수동 마감 — 명세 `PATCH /api/v1/rooms/{roomId}/votes/{voteId}/close`.
 * 작성자만 호출 가능, 이미 CLOSED 면 멱등하게 거절.
 */
export async function closeVoteAction(
  input: unknown,
): Promise<CloseVoteResult> {
  const parsed = idOnlySchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  }
  const { roomId, voteId } = parsed.data;

  if (isMock) {
    const v = votes.find((x) => x.roomId === roomId && x.voteId === voteId);
    if (!v) return { kind: "error", message: "투표를 찾을 수 없습니다." };
    if (v.status === "CLOSED") {
      return { kind: "error", message: "이미 마감된 투표예요." };
    }
    const me = accounts[0];
    if (!me || v.creator.accountId !== me.id) {
      return { kind: "error", message: "투표 작성자만 마감할 수 있어요." };
    }
    v.status = "CLOSED";
    v.closedAt = new Date().toISOString();
    v.closeReason = "MANUAL";
    v.version += 1;
    // 마감 시점에 득표 수를 공개한다 (참여 결과를 그 자리에서 보여줘야 함). 목에선
    // **작성자(나) 의 선택을 먼저 반영** 하고 나머지 다른 참여자 수는 첫 옵션에 몰아주는
    // 단순 모델로 깐다 (실서버는 BE 집계) — 그렇게 안 하면 `myOptionIds` 에 2번 옵션이
    // 남아 있는데 결과엔 1번만 1표로 찍히는 모순이 생긴다 (CodeRabbit).
    const myOptionSet = new Set(v.myOptionIds);
    const iVoted = myOptionSet.size > 0;
    const othersCount = Math.max(0, v.participantCount - (iVoted ? 1 : 0));
    v.options = v.options.map((o, i) => ({
      ...o,
      voteCount:
        (i === 0 ? othersCount : 0) + (myOptionSet.has(o.optionId) ? 1 : 0),
    }));
    const maxVote = Math.max(...v.options.map((o) => o.voteCount ?? 0));
    v.options = v.options.map((o) => ({
      ...o,
      top: (o.voteCount ?? 0) === maxVote && maxVote > 0,
    }));
    v.tied = v.options.filter((o) => o.top).length > 1;
    const { roomId: _r, ...detail } = v;
    void _r;
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: detail };
  }

  try {
    const res = await api<VoteDetail>(
      `/api/v1/rooms/${roomId}/votes/${voteId}/close`,
      { method: "POST" },
    );
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: res };
  } catch (e) {
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return {
      kind: "error",
      message: "투표 마감에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
}

/**
 * 투표 삭제 결과 — kind 리턴 패턴.
 * - `ok` : 삭제 완료 (리스트에서 제거하도록 호출부가 처리)
 * - `error` : 실패
 */
export type DeleteVoteResult =
  | { kind: "ok" }
  | { kind: "error"; message: string };

/**
 * 투표 삭제 — 명세 `DELETE /api/v1/rooms/{roomId}/votes/{voteId}`.
 * 작성자만 호출 가능. 복구 불가 — UI 는 AlertDialog 로 confirm.
 */
export async function deleteVoteAction(
  input: unknown,
): Promise<DeleteVoteResult> {
  const parsed = idOnlySchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "error", message: "요청 형식이 올바르지 않습니다." };
  }
  const { roomId, voteId } = parsed.data;

  if (isMock) {
    const idx = votes.findIndex(
      (x) => x.roomId === roomId && x.voteId === voteId,
    );
    if (idx < 0) return { kind: "error", message: "투표를 찾을 수 없습니다." };
    const target = votes[idx]!;
    const me = accounts[0];
    if (!me || target.creator.accountId !== me.id) {
      return { kind: "error", message: "투표 작성자만 삭제할 수 있어요." };
    }
    votes.splice(idx, 1);
    const source = ideaCards.find((card) => card.roomId === roomId && card.linkedVote?.id === voteId);
    if (source) source.linkedVote = undefined;
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    revalidatePath(`/rooms/${roomId}/boards/idea`);
    return { kind: "ok" };
  }

  try {
    await api(`/api/v1/rooms/${roomId}/votes/${voteId}`, { method: "DELETE" });
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    revalidatePath(`/rooms/${roomId}/boards/idea`);
    return { kind: "ok" };
  } catch (e) {
    if (e instanceof ApiError) return { kind: "error", message: e.message };
    return {
      kind: "error",
      message: "투표 삭제에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
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
 * 재투표 생성 입력 — CLOSED 투표 상세 Sheet 의 "재투표" 다이얼로그가 보내는 shape.
 *
 * ⚠️ 유형(voteType) · 선택지 · maxSelectCount 는 **부모 투표에서 복제**해 서버가 깔아 둔다 —
 *    "같은 조건으로 한 번 더" 가 재투표의 의도라 폼에서 다시 묻지 않는다. 사용자가 조정할 수
 *    있는 건 제목 · 마감 · 익명 셋.
 * ⚠️ 명세의 `VoteDetail.parentVoteId` 를 세팅해 부모와의 연결을 남긴다.
 */
// ⚠️ BE `POST /votes/{id}/revote` 는 `{deadlineAt}` 만 받는다. title·anonymous·선택지·유형은
//    부모 투표에서 **서버가 자동 복제**하므로 입력도 받지 않는다 (사용자가 바꿔봤자 무시됨).
const createRevoteSchema = z
  .object({
    roomId: z.number().int().positive(),
    parentVoteId: z.number().int().positive(),
    deadlineAt: z.string().datetime({ offset: true }),
  })
  .superRefine((v, ctx) => {
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
 * 재투표 생성 결과 — 생성 액션과 같이 kind 리턴.
 * - `ok` : 생성 성공, `vote` 신규 상세 (상세 Sheet 자동 오픈용)
 * - `error` : 검증 실패 or 서버 거절
 */
export type CreateRevoteResult =
  | { kind: "ok"; vote: VoteDetail }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * 재투표 생성 — 명세 `POST /api/v1/rooms/{roomId}/votes` + `parentVoteId` 필드.
 *
 * ⚠️ 별도 엔드포인트가 아니라 **투표 생성 API 에 parentVoteId 를 실어** 서버가 부모의
 *    voteType · options · maxSelectCount 를 자동 복제하도록 위임한다. 명세 확정 전까지는
 *    목 모드에서도 같은 규칙으로 흉내 낸다.
 * ⚠️ 부모는 반드시 **CLOSED** 상태여야 한다 — 진행 중인 투표를 재투표로 "포크" 하는 건
 *    집계 혼선을 부른다. BE 가 400 을 돌려줄 케이스를 FE 에서 먼저 반사한다.
 */
export async function createRevoteAction(
  input: unknown,
): Promise<CreateRevoteResult> {
  const parsed = createRevoteSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      kind: "error",
      message:
        parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.",
      fieldErrors,
    };
  }
  const { roomId, parentVoteId, deadlineAt } = parsed.data;

  if (isMock) {
    const parent = votes.find(
      (x) => x.roomId === roomId && x.voteId === parentVoteId,
    );
    if (!parent) {
      return { kind: "error", message: "원본 투표를 찾을 수 없습니다." };
    }
    if (parent.status !== "CLOSED") {
      return {
        kind: "error",
        message: "아직 마감되지 않은 투표는 재투표로 다시 열 수 없어요.",
      };
    }
    const me = accounts[0];
    if (!me) {
      return { kind: "error", message: "현재 계정을 확인하지 못했습니다." };
    }
    const belongs = roomMembers.some(
      (m) =>
        m.roomId === roomId && m.accountId === me.id && m.state === "ACTIVE",
    );
    if (!belongs) {
      return { kind: "error", message: "이 방의 멤버만 재투표를 만들 수 있어요." };
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
    const existingOptionIds = votes.flatMap((v) =>
      v.options.map((o) => o.optionId),
    );
    let nextOptId = nextMockId(existingOptionIds);
    const detail: VoteDetail = {
      voteId: newVoteId,
      // BE 와 동일하게 부모 제목·익명 설정을 **그대로 복제**. 사용자 수정 포인트 아님.
      title: parent.title,
      voteType: parent.voteType,
      maxSelectCount: parent.maxSelectCount,
      anonymous: parent.anonymous,
      status: "OPEN",
      deadlineAt,
      closeReason: null,
      creator,
      sourceCard: null,
      parentVoteId,
      version: 1,
      participantCount: 0,
      memberCount,
      participants: [],
      myOptionIds: [],
      // 부모 선택지의 content 만 복제 — voteCount / top 은 결과 공개 전까지 없어야 함.
      options: parent.options.map((o) => ({
        optionId: nextOptId++,
        content: o.content,
      })),
      tied: false,
    };
    votes.push({ ...detail, roomId, createdAt: new Date().toISOString() });
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: detail };
  }

  // BE 는 `POST /{voteId}/revote` + `{deadlineAt}` 만 받고 나머지는 부모에서 자동 복제.
  try {
    const res = await api<VoteDetail>(
      `/api/v1/rooms/${roomId}/votes/${parentVoteId}/revote`,
      { method: "POST", json: { deadlineAt } },
    );
    revalidatePath(`/rooms/${roomId}/votes`, "page");
    return { kind: "ok", vote: res };
  } catch (e) {
    if (e instanceof ApiError) {
      return { kind: "error", message: e.message };
    }
    return {
      kind: "error",
      message: "재투표 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }
}

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
      v.closedAt = v.deadlineAt;
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
