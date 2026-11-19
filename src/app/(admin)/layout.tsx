import { redirect } from "next/navigation";

import { getMyAccount } from "@/features/account/server";
import { AdminNav } from "@/features/admin/components/AdminNav";
import { AdminTopbar } from "@/features/admin/components/AdminTopbar";
import { isServiceAdmin } from "@/lib/permission";

/**
 * 관리자 라우트 그룹의 공통 쉘 — 가드가 여기 산다.
 *
 * ⚠️ 가드는 **서버에서 한 번**만 돈다. 하위 Server Component 가 또 `isServiceAdmin` 을 돌
 *    필요는 없다 — 레이아웃이 통과시킨 요청만 하위에 도달한다.
 *
 * ⚠️ 비 ADMIN 접근은 `/` 로 리다이렉트한다. 로그인 안 한 상태는 `getMyAccount` 가 상위 쉘의
 *    인증 흐름을 따라 자동으로 재인증 처리한다 — 여기서 별도로 `/login` 분기를 두지 않는다.
 */

// 관리자 수치·로그는 매 요청 신선해야 한다. prerender 되면 "다시 새로 고침" 이 캐시된
// 숫자를 돌려주는 사고가 생긴다.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getMyAccount();
  if (!isServiceAdmin(me)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="hidden w-60 shrink-0 md:block">
        <AdminNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar me={me} />
        <main id="main" className="min-w-0 flex-1 overflow-x-hidden px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
