/**
 * Next.js 의 `redirect()` / `notFound()` 는 제어 흐름을 중단하기 위해 **예외로 전파**된다.
 * 이 예외는 `digest` 필드가 `NEXT_REDIRECT;...` / `NEXT_HTTP_ERROR_FALLBACK` 로 시작한다.
 *
 * Server Action · server 조회에서 광범위하게 try/catch 로 감쌀 때, 이 예외까지 함께 잡아 버리면
 * 로그인 리다이렉트·404 전환이 사라져 사용자가 잘못된 화면에 그대로 남는다. 일반 API 오류만
 * 자체 처리하고, 이 예외는 반드시 다시 던져야 한다.
 */
export function isNextControlFlowError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK");
}
