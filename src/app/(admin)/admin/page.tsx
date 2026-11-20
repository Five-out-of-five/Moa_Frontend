import { Suspense } from "react";

import { AdminDashboard } from "@/features/admin/components/AdminDashboard";
import { AdminDashboardSkeleton } from "@/features/admin/components/AdminDashboardSkeleton";

export const metadata = {
  title: "관리자 · 대시보드",
};

export default function AdminDashboardPage() {
  // Suspense 로 감싸 두 통계 로더가 대기 중일 때 스켈레톤이 나오게 한다. 세그먼트 `loading.tsx`
  // 를 쓰지 않는 이유 — layout 전체가 fallback 으로 바뀌어 사이드바까지 숨겨지기 때문.
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}
