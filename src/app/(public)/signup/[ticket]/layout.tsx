import type { ReactNode } from "react";

import { MoaLogo } from "@/components/common/MoaLogo";

export default function SignupLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background grid min-h-dvh place-items-center px-5 py-10 sm:py-14">
      <div className="w-full max-w-md">
        <div className="mb-9">
          <MoaLogo />
        </div>
        {children}
      </div>
    </main>
  );
}
