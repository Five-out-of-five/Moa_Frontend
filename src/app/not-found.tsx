import { ErrorState } from "@/components/common/ErrorState";

export default function NotFound() {
  return (
    <ErrorState
      code="404"
      title="페이지를 찾을 수 없어요"
      description={
        <>
          주소가 변경되었거나 삭제된 페이지예요.
          <br />
          입력한 주소를 확인하거나 워크스페이스 목록으로 이동해 주세요.
        </>
      }
      fullPage
    />
  );
}
