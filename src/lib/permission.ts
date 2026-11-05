import type { Account, MemberRef, RoomMember } from "@/types/db";

/**
 * 권한 판정 한 곳. 화면 코드 안에서 역할 상수를 하드코딩하지 않는다.
 *
 * ⚠️ MOA 는 "방 안에서의 권한" 과 "서비스 전체 권한" 이 분리된다.
 *   - 방 안: `room_member.role` (OWNER / MEMBER)
 *   - 서비스 전체: `account.role` (USER / ADMIN)
 *   둘은 **독립**이다. ADMIN 이라도 어떤 방의 OWNER 가 아니면 그 방의 OWNER 전용 조작은 불가.
 */

export function isRoomOwner(member: Pick<RoomMember, "role">): boolean {
  return member.role === "OWNER";
}

export function isActiveMember(member: Pick<RoomMember, "state">): boolean {
  return member.state === "ACTIVE";
}

export function isServiceAdmin(account: Pick<Account, "role">): boolean {
  return account.role === "ADMIN";
}

/**
 * 어떤 리소스의 작성자인지 — 본인 글만 수정·삭제 가능한 경우에 쓴다.
 * OWNER 라도 작성자가 아니면 수정할 수 없다 (리소스 소유권 축).
 */
export function isAuthor(me: Pick<Account, "id">, ref: MemberRef): boolean {
  return me.id === ref.accountId;
}
