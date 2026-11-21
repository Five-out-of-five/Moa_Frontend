"use client";

import { ArrowRight, Clock3, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { dismissNoticeAction } from "./actions";
import { NOTICE_LABELS, type NoticeBannerData } from "./model";

export function NoticeBanner({
  banner,
  refreshAt,
}: {
  banner?: NoticeBannerData | null;
  refreshAt: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const bannerRef = useRef<HTMLElement>(null);
  const noticeId = banner?.noticeId;
  const title = banner?.title;

  useLayoutEffect(() => {
    const element = bannerRef.current;
    const shell = element?.closest<HTMLElement>("[data-shell-body]");
    if (!element || !shell) return;
    const resize = () =>
      shell.style.setProperty("--notice-banner-height", `${element.offsetHeight}px`);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--notice-banner-height");
    };
  }, [noticeId, title]);

  useEffect(() => {
    if (refreshAt === null) return;
    const deadline = refreshAt;
    let timer: number;
    function schedule() {
      const remaining = deadline - Date.now();
      if (remaining <= 0) router.refresh();
      else timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    }
    schedule();
    return () => window.clearTimeout(timer);
  }, [refreshAt, router]);

  if (!banner || !noticeId || !title) return null;
  const urgent = banner.noticeType === "URGENT";
  const Icon = urgent ? TriangleAlert : Clock3;

  return (
    <aside ref={bannerRef} aria-label="서비스 공지" className="px-6 pt-4">
      <div className="border-border bg-card rounded-card mx-auto flex max-w-7xl flex-wrap items-center gap-2 border px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-4">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold",
            urgent
              ? "bg-destructive/10 text-destructive"
              : "border-warning/30 bg-background text-foreground border",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {banner.noticeType ? NOTICE_LABELS[banner.noticeType] : "공지"}
        </span>
        <p className="min-w-0 flex-[1_1_10rem] text-sm font-semibold break-words">{title}</p>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link
            href={`/notices/${noticeId}`}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/70 focus-visible:ring-ring rounded-control inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-semibold whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
          >
            자세히 보기
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
          <button
            type="button"
            aria-label="공지 배너 닫기"
            disabled={pending}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring rounded-control grid size-8 cursor-pointer place-items-center focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            onClick={() =>
              start(async () => {
                try {
                  const result = await dismissNoticeAction(noticeId);
                  if (result.error) toast.error(result.error);
                } catch {
                  toast.error("공지를 닫지 못했어요. 다시 시도해 주세요.");
                }
              })
            }
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
