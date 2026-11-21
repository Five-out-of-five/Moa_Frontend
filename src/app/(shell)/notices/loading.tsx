export default function NoticesLoading() {
  return <div role="status" className="mx-auto max-w-4xl space-y-4">
    <span className="sr-only">공지를 불러오는 중이에요.</span>
    <div aria-hidden="true" className="bg-muted h-8 w-28 animate-pulse rounded-control" />
    <div aria-hidden="true" className="bg-muted h-48 animate-pulse rounded-card" />
  </div>;
}
