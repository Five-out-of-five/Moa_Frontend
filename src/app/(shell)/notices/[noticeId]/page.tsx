import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SafeMarkdown } from "@/features/ai/SafeMarkdown";
import { formatNoticeDate } from "@/features/notice/model";
import { NoticeTypeBadge } from "@/features/notice/NoticeTypeBadge";
import { getNotice } from "@/features/notice/server";

export default async function NoticePage({ params }: { params: Promise<{ noticeId: string }> }) {
  const { noticeId } = await params;
  const id = Number(noticeId);
  if (!/^[1-9]\d*$/.test(noticeId) || !Number.isSafeInteger(id)) notFound();
  const notice = await getNotice(id);
  if (!notice) notFound();
  const startsAt = formatNoticeDate(notice.displayStartsAt);
  const endsAt = formatNoticeDate(notice.displayEndsAt);
  const maintenanceAt = formatNoticeDate(notice.maintenanceStartsAt);

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <Button variant="outline" size="sm" className="text-muted-foreground hover:bg-muted hover:text-foreground shadow-none" asChild>
        <Link href="/notices"><ArrowLeft aria-hidden="true" />공지사항 목록</Link>
      </Button>
      <article className="bg-card border-border rounded-card divide-border divide-y border">
        <header className="space-y-3 p-5 sm:p-6">
          <NoticeTypeBadge type={notice.noticeType} />
          <h1 className="text-2xl font-bold break-words">{notice.title}</h1>
          {startsAt && (
            <p className="text-muted-foreground text-xs">
              <time dateTime={notice.displayStartsAt}>{startsAt}</time>
              {endsAt && <> ~ <time dateTime={notice.displayEndsAt}>{endsAt}</time></>}
            </p>
          )}
          {maintenanceAt && <p className="text-sm">점검 시작 <time dateTime={notice.maintenanceStartsAt}>{maintenanceAt}</time></p>}
        </header>
        <div className="p-5 sm:p-6">
          {notice.content ? <SafeMarkdown text={notice.content} /> : <p className="text-muted-foreground text-sm">등록된 내용이 없어요.</p>}
        </div>
      </article>
    </section>
  );
}
