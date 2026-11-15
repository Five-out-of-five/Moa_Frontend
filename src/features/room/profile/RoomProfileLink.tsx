import { Settings2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { RoomProfileSummary } from "./types";

export function RoomProfileLink({ profile }: { profile: RoomProfileSummary }) {
  return (
    <div className="border-border border-t p-2">
      <Link
        href={`/rooms/${profile.roomId}/profile`}
        aria-label="내 워크스페이스 프로필 설정"
        className="hover:bg-secondary focus-visible:ring-ring flex items-center gap-2 rounded-md p-2 focus-visible:ring-2"
      >
        {profile.imageUrl ? (
          <Image
            src={profile.imageUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="size-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-secondary text-secondary-foreground grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
          >
            {Array.from(profile.name)[0]}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{profile.name}</span>
          {profile.position && (
            <span className="text-muted-foreground block truncate text-xs">{profile.position}</span>
          )}
        </span>
        <Settings2 aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </Link>
    </div>
  );
}
