import { ErrorState } from "@/components/common/ErrorState";

export default function NoticeNotFound() {
  return (
    <ErrorState
      code="404"
      title="공지를 찾을 수 없어요"
      description="삭제되었거나 존재하지 않는 공지예요. 공지사항 목록에서 다시 확인해 주세요."
      returnHref="/notices"
      returnLabel="공지사항 목록으로"
    />
  );
}
