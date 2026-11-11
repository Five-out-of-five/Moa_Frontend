"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const REQUIRED_TERMS = [
  { id: "terms", name: "서비스 이용약관", href: "/terms" },
  { id: "privacy", name: "개인정보 처리방침", href: "/privacy" },
] as const;

export function TermsConsent() {
  const router = useRouter();
  const [consents, setConsents] = useState({ terms: false, privacy: false });
  const hasAcceptedAll = REQUIRED_TERMS.every(({ id }) => consents[id]);

  return (
    <div className="grid gap-3">
      <fieldset className="rounded-card border-border bg-card text-card-foreground min-w-0 divide-y border">
        <legend className="sr-only">필수 약관 동의</legend>
        {REQUIRED_TERMS.map(({ id, name, href }) => (
          <div key={id} className="flex items-center gap-3 px-3 py-2">
            <Checkbox
              id={`consent-${id}`}
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

      <Button
        type="button"
        className="rounded-control h-11 w-full"
        disabled={!hasAcceptedAll}
        onClick={() => router.push("/workspaces")}
      >
        계속하기 <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}
