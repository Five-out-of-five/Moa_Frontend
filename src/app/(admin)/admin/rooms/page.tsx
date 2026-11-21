import { AdminRoomDetailSheet } from "@/features/admin/components/AdminRoomDetailSheet";
import { AdminRoomFilters } from "@/features/admin/components/AdminRoomFilters";
import { AdminRoomsTable } from "@/features/admin/components/AdminRoomsTable";
import {
  getAdminRoomDetail,
  listAdminRooms,
} from "@/features/admin/server";
import type {
  AdminRoomListQuery,
  AdminRoomStatus,
} from "@/features/admin/types";

export const metadata = {
  title: "관리자 · 방 관리",
};

/**
 * 방 관리 — 테이블·필터·상세 Sheet. URL 쿼리 (keyword, status, inactiveDays, sort, page,
 * selected) 를 정본으로.
 */

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function AdminRoomsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const keyword = single(params.keyword);
  const status = single(params.status);
  const inactiveDaysRaw = single(params.inactiveDays);
  const sort = single(params.sort);
  const pageRaw = Number(single(params.page));
  // `?page=0.5` 같은 소수·음수 값이 그대로 넘어가 mock 중간 구간을 조회하는 사고를 막기 위해
  // 정수·음수 아님을 모두 확인.
  const pageNum = Number.isInteger(pageRaw) && pageRaw >= 0 ? pageRaw : 0;
  const selectedRaw = Number(single(params.selected));
  const selectedId =
    Number.isFinite(selectedRaw) && selectedRaw > 0 ? selectedRaw : null;

  const inactiveDaysNum = Number(inactiveDaysRaw);
  const query: AdminRoomListQuery = {
    keyword: keyword || undefined,
    status: (status as AdminRoomStatus) || undefined,
    inactiveDays:
      Number.isFinite(inactiveDaysNum) && inactiveDaysNum > 0
        ? inactiveDaysNum
        : undefined,
    sort: sort || undefined,
    page: pageNum,
    size: 20,
  };

  const [pageRes, detailRes] = await Promise.allSettled([
    listAdminRooms(query),
    selectedId !== null
      ? getAdminRoomDetail(selectedId)
      : Promise.resolve(null),
  ]);

  const pageData = pageRes.status === "fulfilled" ? pageRes.value : null;
  const selectedDetail =
    detailRes.status === "fulfilled" ? detailRes.value : null;
  const selectedDetailFailed =
    selectedId !== null &&
    (detailRes.status === "rejected" || selectedDetail === null);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">방 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          서비스 전체 방을 조회하고, 장기 미사용·신고 다수 방은 비활성 처리합니다.
        </p>
      </header>

      <AdminRoomFilters
        initialKeyword={keyword}
        initialStatus={status}
        initialInactiveDays={inactiveDaysRaw}
        initialSort={sort}
      />

      {pageData ? (
        <AdminRoomsTable page={pageData} selectedId={selectedId} />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
          방 목록을 불러오지 못했습니다.
        </div>
      )}

      <AdminRoomDetailSheet
        initialDetail={selectedDetail}
        selectedId={selectedId}
        loadFailed={selectedDetailFailed}
      />
    </div>
  );
}
