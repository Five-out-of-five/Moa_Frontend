import { openAssistantStream, stopAssistantStream } from "@/features/ai/assistant-server";
import { getAiHistory } from "@/features/ai/server";

export async function GET(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try { return Response.json(await getAiHistory(Number((await params).roomId))); }
  catch { return Response.json({ error: "대화 이력을 불러올 수 없어요." }, { status: 403 }); }
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try { return Boolean(origin && new URL(origin).host === request.headers.get("host")); }
  catch { return false; }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    if (!isSameOrigin(request)) return new Response(null, { status: 403 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("question" in body) || typeof body.question !== "string") throw new Error("질문을 입력해 주세요.");
    return await openAssistantStream(Number((await params).roomId), body.question, request.signal);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "응답을 시작할 수 없어요." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const messageId = new URL(request.url).searchParams.get("messageId");
    await stopAssistantStream(Number((await params).roomId), messageId);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 403 });
  }
}
