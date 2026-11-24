import Link from "next/link";

import { decideRoomJoinAction } from "./invite-actions";
import { RoomCommand } from "./RoomCommand";
import type { getRoomManagement } from "./server";
import { JOIN_REQUEST_STATUSES } from "./types";

type Management = NonNullable<Awaited<ReturnType<typeof getRoomManagement>>>;
const STATUS_LABEL = {
  PENDING: "대기 중",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
  EXPIRED: "만료됨",
};

export function RoomJoinRequests({ management }: { management: Management }) {
  const { room, requests } = management;
  const requestHref = (status: Management["requestStatus"], page: number) =>
    `/workspaces/manage?room=${room.id}&tab=members&status=${status}&page=${page}`;
  return (
    <section className="rounded-card border p-4">
      <h3 className="font-semibold">가입 요청 · {requests.length}건</h3>
      {management.supportsRequestFilters && (
        <nav aria-label="가입 요청 상태" className="mt-2 flex flex-wrap gap-3 text-sm">
          {JOIN_REQUEST_STATUSES.map((status) => (
            <Link
              key={status}
              href={requestHref(status, 0)}
              aria-current={management.requestStatus === status ? "page" : undefined}
              className="underline"
            >
              {STATUS_LABEL[status]}
            </Link>
          ))}
        </nav>
      )}
      {requests.length ? (
        <ul className="divide-border mt-2 divide-y">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <span>{request.name}</span>
              {management.requestStatus === "PENDING" && (
                <div className="flex gap-2">
                  <RoomCommand
                    label="거절"
                    confirmText={`${request.name}님의 참여 요청을 거절할까요?`}
                    action={decideRoomJoinAction.bind(
                      null,
                      room.id,
                      request.accountId,
                      request.id,
                      false,
                    )}
                  />
                  <RoomCommand
                    label="승인"
                    action={decideRoomJoinAction.bind(
                      null,
                      room.id,
                      request.accountId,
                      request.id,
                      true,
                    )}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">표시할 참여 요청이 없습니다.</p>
      )}
      <nav aria-label="가입 요청 페이지" className="mt-2 flex gap-3 text-sm">
        {management.requestPage > 0 && (
          <Link href={requestHref(management.requestStatus, management.requestPage - 1)}>
            이전 페이지
          </Link>
        )}
        {management.hasNextRequestPage && (
          <Link href={requestHref(management.requestStatus, management.requestPage + 1)}>
            다음 페이지
          </Link>
        )}
      </nav>
    </section>
  );
}
