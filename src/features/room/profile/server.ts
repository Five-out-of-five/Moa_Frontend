import "server-only";

import { getFirstRoomProfile } from "../first-profile/server";
import { listMyRooms } from "../server";
import type { RoomProfileSummary } from "./types";

export async function listMyRoomProfiles(): Promise<RoomProfileSummary[]> {
  const rooms = await listMyRooms();
  const entries = await Promise.all(rooms.map(({ id }) => getFirstRoomProfile(String(id))));
  return entries.flatMap((entry) => {
    const setup = entry?.setup;
    if (!setup || setup.needsSetup) return [];
    return [
      {
        roomId: setup.member.roomId,
        name:
          (setup.profile ? setup.profile.nickname : setup.member.nickname) ?? setup.account.name,
        imageUrl: setup.profile?.imageUrl ?? null,
        position: setup.profile?.position ?? null,
      },
    ];
  });
}
