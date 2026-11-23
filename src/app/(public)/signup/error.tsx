"use client";

import Link from "next/link";

import { PageError } from "@/components/common/PageError";
import { Button } from "@/components/ui/button";

export default function SignupError({ reset }: { reset: () => void }) {
  return <PageError title="가입 정보를 불러오지 못했어요" onRetry={reset}><Button asChild variant="ghost"><Link href="/login">로그인으로 돌아가기</Link></Button></PageError>;
}
