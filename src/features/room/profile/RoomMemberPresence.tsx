"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useRoomRealtime } from "@/features/realtime/RoomRealtimeProvider";
import type { MemberRef } from "@/types/db";

function usePresence() {
  const realtime = useRoomRealtime();
  const listen = realtime?.listenPresence;
  const generation = realtime?.connectionGeneration ?? 0;
  const [updates, setUpdates] = useState<{ generation: number; members: Record<number, boolean> }>({ generation: 0, members: {} });

  useEffect(() => listen?.(({ accountId, online }, eventGeneration) => {
    setUpdates((current) => ({
      generation: eventGeneration,
      members: { ...(current.generation === eventGeneration ? current.members : {}), [accountId]: online },
    }));
  }), [listen]);

  return updates.generation === generation ? updates.members : {};
}

function PresenceLabel({ online }: { online: boolean | undefined }) {
  return online === undefined ? null : <span className={online ? "text-success text-xs" : "text-muted-foreground text-xs"}>
    {online ? "온라인" : "오프라인"}
  </span>;
}

export function RoomMemberOnline({ accountId, online }: { accountId: number; online?: boolean }) {
  const presence = usePresence();
  return <PresenceLabel online={presence[accountId] ?? online} />;
}

export function RoomMemberList({ roomId, members }: {
  roomId: number;
  members: (MemberRef & { online?: boolean })[];
}) {
  const presence = usePresence();
  return <ul className="grid gap-2 sm:grid-cols-2">
    {members.map(({ accountId, displayName, profileImageUrl, online }) => (
      <li key={accountId} data-briefing-id={accountId} className="bg-card border-border rounded-control data-briefing-highlight:ring-primary border p-3 data-briefing-highlight:ring-2">
        <Link className="flex min-w-0 items-center gap-2 text-sm font-medium hover:underline" href={`/rooms/${roomId}/members/${accountId}`}>
          {profileImageUrl && <Image src={profileImageUrl} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded-full object-cover" />}
          <span className="min-w-0 flex-1 break-words">{displayName}</span>
          <PresenceLabel online={presence[accountId] ?? online} />
        </Link>
      </li>
    ))}
  </ul>;
}
