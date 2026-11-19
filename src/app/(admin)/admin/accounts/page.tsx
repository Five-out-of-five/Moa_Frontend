import { getMyAccount } from "@/features/account/server";
import { AdminAccountDetailSheet } from "@/features/admin/components/AdminAccountDetailSheet";
import { AdminAccountFilters } from "@/features/admin/components/AdminAccountFilters";
import { AdminAccountsTable } from "@/features/admin/components/AdminAccountsTable";
import {
  getAdminAccountDetail,
  listAdminAccounts,
} from "@/features/admin/server";
import type {
  AdminAccountListQuery,
  AdminAccountRole,
  AdminAccountStatus,
  AdminSocialProvider,
} from "@/features/admin/types";

export const metadata = {
  title: "관리자 · 회원 관리",
};

/**
 * 회원 관리 — 테이블·필터·상세 Sheet 를 조합. 검색/필터/페이지/선택 상태는 전부 **URL 쿼리**
 * 를 정본으로 삼아 공유 가능한 뷰를 유지한다 (관리자끼리 링크 공유해서 특정 회원을 바로 볼 수
 * 있도록).
 *
 * ⚠️ Sheet 는 쿼리 `selected` 를 감시한다. 선택이 있으면 서버가 상세를 **같이** 로드해 하위로
 *    넘긴다 — 클라이언트가 추가 round-trip 으로 상세를 다시 부르는 비용을 없애기 위함.
 */

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function AdminAccountsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const keyword = single(params.keyword);
  const role = single(params.role);
  const status = single(params.status);
  const provider = single(params.provider);
  const pageRaw = Number(single(params.page));
  const pageNum = Number.isFinite(pageRaw) && pageRaw >= 0 ? pageRaw : 0;
  const selectedRaw = Number(single(params.selected));
  const selectedId =
    Number.isFinite(selectedRaw) && selectedRaw > 0 ? selectedRaw : null;

  const query: AdminAccountListQuery = {
    keyword: keyword || undefined,
    role: (role as AdminAccountRole) || undefined,
    status: (status as AdminAccountStatus) || undefined,
    provider: (provider as AdminSocialProvider) || undefined,
    page: pageNum,
    size: 20,
  };

  // 목록 · 선택된 상세 · 본인 계정을 병렬 조회. 한쪽이 실패해도 다른 블록을 보여주기 위해
  // allSettled 로 분리.
  const [pageRes, detailRes, meRes] = await Promise.allSettled([
    listAdminAccounts(query),
    selectedId !== null ? getAdminAccountDetail(selectedId) : Promise.resolve(null),
    getMyAccount(),
  ]);

  const pageData =
    pageRes.status === "fulfilled" ? pageRes.value : null;
  const selectedDetail =
    detailRes.status === "fulfilled" ? detailRes.value : null;
  const me = meRes.status === "fulfilled" ? meRes.value : null;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">회원 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          서비스 전체 회원을 조회하고, 역할 변경 · 정지 / 정지 해제를 처리합니다.
        </p>
      </header>

      <AdminAccountFilters
        initialKeyword={keyword}
        initialRole={role}
        initialStatus={status}
        initialProvider={provider}
      />

      {pageData ? (
        <AdminAccountsTable page={pageData} selectedId={selectedId} />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
          회원 목록을 불러오지 못했습니다.
        </div>
      )}

      {me && (
        <AdminAccountDetailSheet
          initialDetail={selectedDetail}
          meAccountId={me.id}
        />
      )}
    </div>
  );
}
