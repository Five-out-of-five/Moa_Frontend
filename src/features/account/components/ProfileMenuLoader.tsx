import { getMyAccount } from "../server";
import { ProfileMenu, ProfileMenuErrorState } from "./ProfileMenu";

/**
 * 헤더 프로필 메뉴의 서버 측 로더.
 *
 * ⚠️ 실패 시 `ProfileMenuFallback` (대기 스켈레톤) 으로 떨어뜨리지 않는다 — 요청이
 *    끝났는데 스켈레톤을 유지하면 사용자는 영원히 로딩으로 오해하고 **로그아웃도 못한다**.
 *    대신 `ProfileMenuErrorState` 로 보내 "다시 시도 / 로그아웃" 을 제공한다.
 */
export async function ProfileMenuLoader() {
  try {
    const account = await getMyAccount();
    return <ProfileMenu account={account} />;
  } catch (error) {
    console.error("ProfileMenuLoader failed:", error);
    return <ProfileMenuErrorState />;
  }
}
