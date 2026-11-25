import { Suspense } from "react";

import { NoticeBannerLoader } from "@/features/notice/NoticeBannerLoader";
import { getToneMode } from "@/features/tone/server";
import { ToneProvider } from "@/features/tone/ToneProvider";

import styles from "./app-shell.module.css";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const toneMode = await getToneMode().catch(() => null);
  return (
    <ToneProvider mode={toneMode}>
      <div className={`${styles.shell} bg-background min-h-dvh`}>
        <div className={styles.chrome}>
          <Header />
        </div>
        <div className={`${styles.frame} flex pt-[var(--header-height)]`}>
          <div className={styles.chrome}>
            <Sidebar />
          </div>
          <div
            data-shell-body
            className="min-w-0 flex-1 [--shell-header-height:var(--header-height)]"
          >
            <div className={styles.chrome}>
              <Suspense fallback={null}>
                <NoticeBannerLoader />
              </Suspense>
            </div>
            <main
              id="main"
              className={`${styles.main} min-w-0 overflow-x-hidden px-6 py-6 [--header-height:calc(var(--shell-header-height)_+_var(--notice-banner-height,0px))]`}
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </ToneProvider>
  );
}
