import { ErrorState } from "@/components/common/ErrorState";

export default function MemberNotFound() {
  return (
    <ErrorState
      code="404"
      title="멤버 프로필을 찾을 수 없어요"
      description="프로필을 볼 수 있는 멤버인지 확인해 주세요."
    />
  );
}
