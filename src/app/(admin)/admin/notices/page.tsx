import { AdminNoticeDetailSheet } from "@/features/admin/components/AdminNoticeDetailSheet";
import { AdminNoticesTable } from "@/features/admin/components/AdminNoticesTable";
import { AdminNoticesToolbar } from "@/features/admin/components/AdminNoticesToolbar";
import {
  getAdminNoticeDetail,
  listAdminNotices,
} from "@/features/admin/server";
import type {
  AdminNoticeListQuery,
  AdminNoticeType,
} from "@/features/admin/types";

export const metadata = {
  title: "관리자 · 공지 관리",
};

/**
 * 공지 관리. 테이블 · 필터 · 상세 Sheet 조합. URL 쿼리 (`noticeType`, `state`, `page`,
 * `selected`) 를 정본으로 삼아 공유 가능한 뷰 유지.
 */

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function AdminNoticesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const noticeType = single(params.noticeType);
  const state = single(params.state);
  const pageRaw = Number(single(params.page));
  const pageNum = Number.isFinite(pageRaw) && pageRaw >= 0 ? pageRaw : 0;
  const selectedRaw = Number(single(params.selected));
  const selectedId =
    Number.isFinite(selectedRaw) && selectedRaw > 0 ? selectedRaw : null;

  const query: AdminNoticeListQuery = {
    noticeType: (noticeType as AdminNoticeType) || undefined,
    state: state || undefined,
    page: pageNum,
    size: 20,
  };

  const [pageRes, detailRes] = await Promise.allSettled([
    listAdminNotices(query),
    selectedId !== null
      ? getAdminNoticeDetail(selectedId)
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
        <h1 className="text-xl font-semibold text-slate-900">공지 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          서비스 전체 공지를 등록·수정·삭제하고, 노출 기간과 유형을 지정합니다.
        </p>
      </header>

      <AdminNoticesToolbar initialNoticeType={noticeType} initialState={state} />

      {pageData ? (
        <AdminNoticesTable page={pageData} selectedId={selectedId} />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
          공지 목록을 불러오지 못했습니다.
        </div>
      )}

      <AdminNoticeDetailSheet
        initialDetail={selectedDetail}
        selectedId={selectedId}
        loadFailed={selectedDetailFailed}
      />
    </div>
  );
}
