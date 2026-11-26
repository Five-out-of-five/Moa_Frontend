import { unstable_rethrow } from "next/navigation";

import { openAssistantStream, resolveAssistantCard } from "@/features/ai/assistant-server";
import { getAiHistory, getAiQuota } from "@/features/ai/server";
import { isSameOriginRequest } from "@/features/auth/origin";
import { ApiError } from "@/lib/api";

type RouteContext = { params: Promise<{ roomId: string }> };

function failure(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof ApiError) {
    return Response.json({ success: false, error: { code: error.code, message: error.message, traceId: error.traceId } }, { status: error.status >= 400 ? error.status : 502 });
  }
  return Response.json({ success: false, error: { code: "AI_UNAVAILABLE", message: "AI 요청을 처리하지 못했어요. 다시 시도해 주세요." } }, { status: 503 });
}

async function readRoomId({ params }: RouteContext) {
  const id = Number((await params).roomId);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "방 정보가 올바르지 않아요.", "COMMON_INVALID_INPUT");
  return id;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const roomId = await readRoomId(context);
    const query = new URL(request.url).searchParams;
    const card = query.get("card");
    if (card !== null) {
      const id = Number(card);
      if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, "카드 정보가 올바르지 않아요.", "COMMON_INVALID_INPUT");
      const target = await resolveAssistantCard(roomId, id);
      return new Response(null, { status: 302, headers: { Location: target ?? `/rooms/${roomId}/boards/idea`, "Cache-Control": "no-store" } });
    }
    const result = query.has("quota") ? await getAiQuota(roomId) : await getAiHistory(roomId, query.get("before"));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) throw new ApiError(403, "요청 출처를 확인해 주세요.", "COMMON_FORBIDDEN");
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !("question" in body) || typeof body.question !== "string") {
      throw new ApiError(400, "질문을 입력해 주세요.", "COMMON_INVALID_INPUT");
    }
    return await openAssistantStream(await readRoomId(context), body.question, request.signal);
  } catch (error) {
    return failure(error);
  }
}
