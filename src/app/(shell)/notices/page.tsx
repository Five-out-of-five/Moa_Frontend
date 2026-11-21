import { ArrowRight, Megaphone } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatNoticeDate } from "@/features/notice/model";
import { NoticeTypeBadge } from "@/features/notice/NoticeTypeBadge";
import { listNotices } from "@/features/notice/server";

export default async function NoticesPage({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const page = rawPage && /^\d{1,6}$/.test(rawPage) ? Number(rawPage) : 0;
  const data = await listNotices(page);
  const notices = (data.content ?? []).filter(({ noticeId, title }) => noticeId && title);

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">공지사항</h1>
        <p className="text-muted-foreground mt-1 text-sm">서비스 소식과 점검 일정을 확인하세요.</p>
      </header>
      <div className="bg-card border-border rounded-card border">
        {notices.length ? (
          <ul className="divide-border divide-y">
            {notices.map(({ noticeId, noticeType, title, displayStartsAt }) => (
              <li key={noticeId}>
                <Link href={`/notices/${noticeId}`} className="hover:bg-muted/50 focus-visible:ring-ring flex flex-wrap items-center gap-3 rounded-control p-4 focus-visible:ring-2 focus-visible:outline-none">
                  <NoticeTypeBadge type={noticeType} />
                  <p className="min-w-40 flex-1 text-sm font-semibold break-words">{title}</p>
                  {formatNoticeDate(displayStartsAt) && <time dateTime={displayStartsAt} className="text-muted-foreground text-xs">{formatNoticeDate(displayStartsAt)}</time>}
                  <ArrowRight aria-hidden="true" className="text-muted-foreground size-4" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted-foreground grid justify-items-center gap-3 p-10 text-sm">
            <Megaphone aria-hidden="true" className="size-5" />
            <p>{page ? "이 페이지에 공지가 없어요." : "현재 게시된 공지가 없어요."}</p>
          </div>
        )}
      </div>
      {(page > 0 || data.hasNext) && (
        <nav aria-label="공지 페이지" className="flex items-center justify-center gap-3">
          {page > 0 && <Button asChild size="sm" variant="outline"><Link href={page === 1 ? "/notices" : `/notices?page=${page - 1}`}>이전</Link></Button>}
          <span className="text-sm">{page + 1} 페이지</span>
          {data.hasNext && <Button asChild size="sm" variant="outline"><Link href={`/notices?page=${page + 1}`}>다음</Link></Button>}
        </nav>
      )}
    </section>
  );
}
