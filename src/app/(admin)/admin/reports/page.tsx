import { AdminReportDetailSheet } from "@/features/admin/components/AdminReportDetailSheet";
import { AdminReportFilters } from "@/features/admin/components/AdminReportFilters";
import { AdminReportsTable } from "@/features/admin/components/AdminReportsTable";
import {
  getAdminReportDetail,
  listAdminReports,
} from "@/features/admin/server";
import type {
  AdminReportListQuery,
  AdminReportReason,
  AdminReportStatus,
  AdminReportTargetType,
} from "@/features/admin/types";

export const metadata = {
  title: "관리자 · 신고 관리",
};

/**
 * 신고 관리. 테이블·필터·상세 Sheet 조합을 회원 관리와 똑같이 URL 쿼리 정본으로 둔다.
 * 선택된 신고는 서버 쪽에서 목록과 **같이 로드** 해 하위로 넘긴다 — 클라이언트가 상세를 다시
 * 부르는 round-trip 비용 제거.
 */

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const status = single(params.status);
  const targetType = single(params.targetType);
  const reason = single(params.reason);
  const pageRaw = Number(single(params.page));
  const pageNum = Number.isFinite(pageRaw) && pageRaw >= 0 ? pageRaw : 0;
  const selectedRaw = Number(single(params.selected));
  const selectedId =
    Number.isFinite(selectedRaw) && selectedRaw > 0 ? selectedRaw : null;

  const query: AdminReportListQuery = {
    status: (status as AdminReportStatus) || undefined,
    targetType: (targetType as AdminReportTargetType) || undefined,
    reason: (reason as AdminReportReason) || undefined,
    page: pageNum,
    size: 20,
  };

  const [pageRes, detailRes] = await Promise.allSettled([
    listAdminReports(query),
    selectedId !== null
      ? getAdminReportDetail(selectedId)
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
        <h1 className="text-xl font-semibold text-slate-900">신고 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          접수된 신고를 조회하고, 처리 담당자 지정 · 조치 완료 / 반려를 수행합니다.
        </p>
      </header>

      <AdminReportFilters
        initialStatus={status}
        initialTargetType={targetType}
        initialReason={reason}
      />

      {pageData ? (
        <AdminReportsTable page={pageData} selectedId={selectedId} />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
          신고 목록을 불러오지 못했습니다.
        </div>
      )}

      <AdminReportDetailSheet
        initialDetail={selectedDetail}
        selectedId={selectedId}
        loadFailed={selectedDetailFailed}
      />
    </div>
  );
}
