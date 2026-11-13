import type { ReactNode } from "react";

import { MoaLogo } from "@/components/common/MoaLogo";

export default function WorkspacesLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background min-h-dvh px-5 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-9">
          <MoaLogo />
        </div>
        {children}
      </div>
    </main>
  );
}
