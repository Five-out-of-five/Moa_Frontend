import { AuthCallback } from "@/features/auth/components/AuthCallback";
import { getAuthReturnPath } from "@/features/auth/return-path";

export const dynamic = "force-dynamic";
export default async function AuthCallbackPage({ searchParams }: { searchParams: Promise<{ returnPath?: string; reason?: string }> }) {
  const query = await searchParams;
  // 외부 OAuth의 첫 요청은 Strict 쿠키 없이 페이지부터 표시한다.
  return <AuthCallback returnPath={getAuthReturnPath(query.returnPath) ?? undefined} reason={query.reason === "expired" ? "expired" : undefined} />;
}
