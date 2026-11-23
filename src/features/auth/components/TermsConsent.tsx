"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { completeMockSignupAction } from "../actions";

const REQUIRED_TERMS = [
  { id: "terms", name: "서비스 이용약관", href: "/terms" },
  { id: "privacy", name: "개인정보 처리방침", href: "/privacy" },
] as const;

export function TermsConsent({ ticket, next, defaultName }: { ticket: string; next?: string; defaultName: string }) {
  const nameId = useId();
  const [name, setName] = useState(defaultName);
  const [consents, setConsents] = useState({ terms: false, privacy: false });
  const [result, action, pending] = useActionState(completeMockSignupAction.bind(null, ticket, next), {});
  const hasAcceptedAll = REQUIRED_TERMS.every(({ id }) => consents[id]);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }} className="grid gap-3">
      <div className="grid gap-2 text-left text-sm font-medium">
        <label htmlFor={nameId}>기본 이름</label>
        <Input id={nameId} name="name" value={name} onChange={(event) => setName(event.target.value)} readOnly={pending} required minLength={2} maxLength={20} aria-invalid={Boolean(result.nameError)} aria-describedby={result.nameError ? `${nameId}-error` : undefined} />
        {result.nameError && <p id={`${nameId}-error`} role="alert" className="text-destructive text-sm">{result.nameError}</p>}
      </div>
      <fieldset disabled={pending} className="rounded-card border-border bg-card text-card-foreground min-w-0 divide-y border">
        <legend className="sr-only">필수 약관 동의</legend>
        {REQUIRED_TERMS.map(({ id, name, href }) => (
          <div key={id} className="flex items-center gap-3 px-3 py-2">
            <Checkbox
              id={`consent-${id}`}
              name={id}
              required
              checked={consents[id]}
              onCheckedChange={(checked) =>
                setConsents((current) => ({ ...current, [id]: checked === true }))
              }
            />
            <label
              htmlFor={`consent-${id}`}
              className="min-w-0 flex-1 cursor-pointer text-sm font-medium"
            >
              {name} 동의 <span className="text-primary text-xs">필수</span>
            </label>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground shrink-0"
            >
              <Link
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${name} 전문 보기 (새 탭)`}
              >
                <ExternalLink aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ))}
      </fieldset>

      {result.error && <p role="alert" className="text-destructive text-sm">{result.error}</p>}
      {result.traceId && <p className="text-muted-foreground text-xs">오류 확인 번호: {result.traceId}</p>}
      <Button
        type="submit"
        className="rounded-control h-11 w-full"
        disabled={!hasAcceptedAll || pending}
      >
        {pending ? "처리 중…" : "계속하기"} <ArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}
