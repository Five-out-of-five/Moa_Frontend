"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function RetryAuth() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button type="button" variant="outline" disabled={pending} onClick={() => start(() => router.refresh())}>{pending ? "다시 확인 중…" : "다시 시도"}</Button>;
}
