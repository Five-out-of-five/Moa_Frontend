import { CircleCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { TermsConsent } from "@/features/auth/components/TermsConsent";
import { SOCIAL_PROVIDER_NAMES } from "@/features/auth/providers";
import { getSignupAccount } from "@/features/auth/server";

export default async function SignupPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params;
  const account = getSignupAccount(ticket);

  if (!account) {
    return (
      <section className="grid justify-items-center gap-3 text-center">
        <h1 className="text-xl font-bold">계정 정보를 찾을 수 없어요</h1>
        <p className="text-muted-foreground text-sm">
          로그인 화면에서 소셜 계정을 다시 선택해 주세요.
        </p>
        <Button asChild variant="outline">
          <Link href="/login">로그인으로 돌아가기</Link>
        </Button>
      </section>
    );
  }

  const provider = SOCIAL_PROVIDER_NAMES[account.provider];

  return (
    <section aria-labelledby="signup-title" className="grid gap-3">
      <header className="mb-4 text-center">
        <p className="text-primary text-xs font-semibold">처음 방문하셨군요</p>
        <h1 id="signup-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {`${provider} 계정으로 로그인했어요`}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed break-keep">
          {`${account.displayName}님, MOA를 시작하기 전에 필수 약관을 확인해 주세요.`}
        </p>
      </header>

      <div className="rounded-card border-border bg-card text-card-foreground flex items-center gap-3 border px-3 py-3">
        <span
          aria-hidden="true"
          className="bg-secondary text-secondary-foreground grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold"
        >
          {Array.from(account.displayName)[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold break-words">{account.displayName}</p>
          <p className="text-muted-foreground text-xs">{`${provider} 계정에서 가져온 이름`}</p>
        </div>
        <CircleCheck aria-hidden="true" className="text-success size-4 shrink-0" />
      </div>

      <TermsConsent />
    </section>
  );
}
