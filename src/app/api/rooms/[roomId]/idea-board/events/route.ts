import { getMockIdeaSnapshot } from "@/features/idea/server";
import { openMockRoomEvents } from "@/features/widget/server";

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const id = Number((await params).roomId);
  if (!Number.isSafeInteger(id) || id < 1) return new Response(null, { status: 404 });
  return openMockRoomEvents(id, request.signal, () => getMockIdeaSnapshot(id));
}
