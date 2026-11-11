import { ArrowRight, ChartNoAxesColumn } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SOCIAL_PROVIDER_NAMES } from "@/features/auth/providers";
import { getSignupPreviewHref } from "@/features/auth/server";

const SOCIAL_LOGIN_OPTIONS = [
  { provider: "GOOGLE", initial: "G", badgeClassName: "border bg-card text-foreground" },
  { provider: "KAKAO", initial: "K", badgeClassName: "bg-login-kakao text-login-kakao-foreground" },
  { provider: "NAVER", initial: "N", badgeClassName: "bg-login-naver text-login-badge-light" },
] as const;

export default function LoginPage() {
  return (
    <main className="bg-login-surface grid min-h-dvh place-items-center px-5 py-10 sm:py-14">
      <section aria-labelledby="login-title" className="w-full max-w-md text-center">
        <div className="text-login-wordmark flex items-center justify-center gap-2 font-bold">
          <span className="bg-login-brand text-login-badge-light grid size-8 place-items-center rounded-lg">
            <ChartNoAxesColumn aria-hidden="true" className="size-5" strokeWidth={3} />
          </span>
          <span>MOA</span>
        </div>

        <h1 id="login-title" className="mt-9 text-2xl font-bold tracking-tight sm:text-3xl">
          함께 일하는 순간을 더 선명하게
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed break-keep">
          MOA에서 아이디어와 업무, 팀의 대화를 한 흐름으로 연결하세요.
        </p>

        <ul className="mt-7 grid gap-2.5">
          {SOCIAL_LOGIN_OPTIONS.map(({ provider, initial, badgeClassName }) => {
            const href = getSignupPreviewHref(provider);
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`${badgeClassName} grid size-6 place-items-center rounded-full text-xs font-bold`}
                >
                  {initial}
                </span>
                <span>{`${SOCIAL_PROVIDER_NAMES[provider]}로 계속하기`}</span>
                <ArrowRight aria-hidden="true" className="text-muted-foreground" />
              </>
            );

            return (
              <li key={provider}>
                <Button
                  asChild={href !== null}
                  disabled={href === null}
                  variant="outline"
                  className="bg-card text-card-foreground hover:border-ring/60 focus-visible:ring-ring active:bg-accent-foreground/10 dark:active:bg-accent-foreground/10 grid h-12 w-full grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] justify-items-center rounded-lg px-3 active:shadow-none"
                >
                  {href ? <Link href={href}>{content}</Link> : content}
                </Button>
              </li>
            );
          })}
        </ul>

        <p className="text-muted-foreground mt-7 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs leading-relaxed">
          <span>로그인하면 MOA의 이용약관에 동의하게 됩니다.</span>
          <span className="text-foreground font-medium">초대 링크가 있나요?</span>
        </p>
      </section>
    </main>
  );
}
