import { redirect } from "next/navigation";

import { Input } from "@/components/ui/input";

import { getAuthFailure } from "./auth-failure";
import { RetryAuth } from "./components/RetryAuth";
import { TermsConsent } from "./components/TermsConsent";
import { getAuthLoginHref } from "./errors";
import { SOCIAL_PROVIDER_NAMES } from "./providers";
import { getSignupAccount } from "./server";

export async function SignupScreen({ ticket, next }: { ticket: string; next?: string }) {
  let account: Awaited<ReturnType<typeof getSignupAccount>>;
  try { account = await getSignupAccount(ticket); }
  catch (error) {
    const failure = getAuthFailure(error);
    if (failure.code === "AUTH_SIGNUP_TICKET_INVALID") redirect(getAuthLoginHref(failure.code, undefined, failure.traceId, next));
    return <section className="space-y-3 text-center"><h1 className="text-xl font-bold">가입 정보를 불러오지 못했어요</h1><p role="alert" className="text-destructive text-sm">{failure.error}</p>{failure.traceId && <p className="text-muted-foreground text-xs">오류 확인 번호: {failure.traceId}</p>}<RetryAuth /></section>;
  }
  if (!account) redirect(getAuthLoginHref("AUTH_SIGNUP_TICKET_INVALID", undefined, undefined, next));
  const provider = SOCIAL_PROVIDER_NAMES[account.provider];
  return <section aria-labelledby="signup-title" className="grid gap-4">
    <header className="mb-2 text-center"><h1 id="signup-title" className="text-2xl font-bold">{provider} 계정으로 로그인했어요</h1><p className="text-muted-foreground mt-2 text-sm">MOA를 시작하기 전에 이름과 필수 약관을 확인해 주세요.</p></header>
    <div className="space-y-2"><label htmlFor="signup-email" className="text-sm font-medium">이메일</label><Input id="signup-email" value={account.email} readOnly type="email" autoComplete="email" /><p className="text-muted-foreground text-xs">{provider} 계정에서 받은 이메일이에요.</p></div>
    <TermsConsent ticket={ticket} next={next} defaultName={account.displayName} />
  </section>;
}
