import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">계정 설정을 불러오는 중</span>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
