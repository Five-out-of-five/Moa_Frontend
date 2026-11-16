import { openDashboardEvents } from "@/features/widget/server";

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const roomId = Number((await params).roomId);
  if (!Number.isSafeInteger(roomId) || roomId < 1) return new Response(null, { status: 404 });
  return openDashboardEvents(roomId, request.signal);
}
