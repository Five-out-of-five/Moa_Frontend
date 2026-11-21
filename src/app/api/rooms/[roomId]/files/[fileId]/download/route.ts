import { downloadRoomFile } from "@/features/room-files/server";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ roomId: string; fileId: string }>;
  },
) {
  const { roomId, fileId } = await params;
  return downloadRoomFile(roomId, fileId);
}
