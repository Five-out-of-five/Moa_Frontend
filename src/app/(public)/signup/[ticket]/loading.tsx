import { PageLoading } from "@/components/common/PageLoading";
import { Skeleton } from "@/components/ui/skeleton";

export default function SignupLoading() {
  return (
    <PageLoading label="가입 정보를 불러오는 중입니다.">
      <div aria-hidden="true" className="grid gap-3">
        <Skeleton className="mx-auto mb-4 h-20 w-4/5" />
        <Skeleton className="rounded-card h-14 w-full" />
        <Skeleton className="rounded-card h-24 w-full" />
        <Skeleton className="rounded-control h-11 w-full" />
      </div>
    </PageLoading>
  );
}
