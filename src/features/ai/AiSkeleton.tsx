export function AiSkeleton() {
  return <div role="status" aria-label="응답을 준비하는 중" className="animate-pulse space-y-2 py-3">
    <div className="bg-muted h-3 w-4/5 rounded" /><div className="bg-muted h-3 w-full rounded" /><div className="bg-muted h-3 w-2/3 rounded" />
  </div>;
}
