export function isInviteToken(token: unknown): token is string {
  return typeof token === "string" && token.length > 0 && !/[^\w-]/.test(token);
}

export function getInviteReturnPath(input: string, origin: string) {
  try {
    const url = new URL(input.trim(), origin);
    const prefix = "/invite/";
    if (url.origin === origin && url.pathname.startsWith(prefix) && isInviteToken(url.pathname.slice(prefix.length))) {
      return url.pathname;
    }
  } catch {
    // 주소를 해석할 수 없으면 초대 입력 오류로 안내한다.
  }
  return null;
}
