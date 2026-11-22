import { Suspense } from "react";

import { NoticeBannerLoader } from "@/features/notice/NoticeBannerLoader";
import { getToneMode } from "@/features/tone/server";
import { ToneProvider } from "@/features/tone/ToneProvider";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const toneMode = await getToneMode().catch(() => null);
  return (
    <ToneProvider mode={toneMode}>
      <div className="bg-background min-h-dvh">
        <Header />
        <div className="flex pt-[var(--header-height)]">
          <Sidebar />
          <div data-shell-body className="min-w-0 flex-1 [--shell-header-height:var(--header-height)]">
            <Suspense fallback={null}><NoticeBannerLoader /></Suspense>
            <main id="main" className="min-w-0 overflow-x-hidden px-6 py-6 [--header-height:calc(var(--shell-header-height)_+_var(--notice-banner-height,0px))]">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ToneProvider>
  );
}
