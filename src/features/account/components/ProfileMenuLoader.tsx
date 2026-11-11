import { getMyAccount } from "../server";
import { ProfileMenu, ProfileMenuFallback } from "./ProfileMenu";

/**
 * 헤더 프로필 메뉴의 서버 측 로더. 실패하면 로그인 전 스켈레톤 상태로 떨어뜨려
 * 헤더 나머지(워크스페이스·알림) 는 계속 쓸 수 있게 둔다.
 */
export async function ProfileMenuLoader() {
  try {
    const account = await getMyAccount();
    return <ProfileMenu account={account} />;
  } catch {
    return <ProfileMenuFallback />;
  }
}
