export default function RoomFilesLoading() {
  return (
    <div role="status" className="mx-auto max-w-7xl space-y-4">
      <span className="sr-only">파일 목록을 불러오는 중이에요.</span>
      <div aria-hidden="true" className="bg-muted rounded-control h-8 w-24 animate-pulse" />
      <div aria-hidden="true" className="bg-muted rounded-card h-28 animate-pulse" />
      <div aria-hidden="true" className="bg-muted rounded-card h-64 animate-pulse" />
    </div>
  );
}
