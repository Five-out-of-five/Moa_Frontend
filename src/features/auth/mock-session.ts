export const MOCK_ACCOUNT_COOKIE = "moa_mock_account";
export const MOCK_ACCOUNT_IDS = { GOOGLE: 1, KAKAO: 2, NAVER: 5 } as const;

export function getInviteReturnPath(value: unknown) {
  return typeof value === "string" &&
    /^\/invite\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
