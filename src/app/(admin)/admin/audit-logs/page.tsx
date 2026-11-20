import { AdminAuditLogFilters } from "@/features/admin/components/AdminAuditLogFilters";
import { AdminAuditLogsTable } from "@/features/admin/components/AdminAuditLogsTable";
import { listAdminAuditLogs } from "@/features/admin/server";
import type { AdminAuditLogListQuery } from "@/features/admin/types";

export const metadata = {
  title: "관리자 · 감사 로그",
};

/**
 * 감사 로그. 읽기 전용 · 상세 Sheet 없음 — 한 행에 모든 정보가 들어간다. URL 쿼리 (`from`,
 * `to`, `actionType`, `targetType`, `page`) 를 정본으로 공유 가능한 뷰 유지.
 */

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function AdminAuditLogsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const from = single(params.from);
  const to = single(params.to);
  const actionType = single(params.actionType);
  const targetType = single(params.targetType);
  const pageRaw = Number(single(params.page));
  const pageNum = Number.isFinite(pageRaw) && pageRaw >= 0 ? pageRaw : 0;

  const query: AdminAuditLogListQuery = {
    from: from || undefined,
    to: to || undefined,
    actionType: actionType || undefined,
    targetType: targetType || undefined,
    page: pageNum,
    size: 20,
  };

  let pageData: Awaited<ReturnType<typeof listAdminAuditLogs>> | null = null;
  try {
    pageData = await listAdminAuditLogs(query);
  } catch {
    pageData = null;
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">감사 로그</h1>
        <p className="mt-1 text-sm text-slate-500">
          관리자가 수행한 운영 행동을 기간 · 액션 · 대상 유형으로 조회합니다.
        </p>
      </header>

      <AdminAuditLogFilters
        initialFrom={from}
        initialTo={to}
        initialActionType={actionType}
        initialTargetType={targetType}
      />

      {pageData ? (
        <AdminAuditLogsTable page={pageData} />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
          감사 로그를 불러오지 못했습니다.
        </div>
      )}
    </div>
  );
}
