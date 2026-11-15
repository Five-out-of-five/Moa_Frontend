import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MoaLogo } from "@/components/common/MoaLogo";

export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background min-h-dvh px-5 py-12 sm:py-16">
      <section className="mx-auto w-full max-w-md">
        <header className="mb-7 text-center">
          <MoaLogo />
          <h1 className="mt-8 text-2xl font-bold tracking-tight">초대받은 워크스페이스</h1>
          <p className="text-muted-foreground mt-2 text-sm break-keep">
            워크스페이스 정보를 확인하고 참여 요청을 보내세요.
          </p>
        </header>
        <div className="space-y-3">{children}</div>
        <Link
          href="/workspaces"
          className="text-primary mx-auto mt-5 flex w-fit items-center gap-2 rounded-sm text-sm font-medium hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          워크스페이스 목록으로
        </Link>
      </section>
    </main>
  );
}
