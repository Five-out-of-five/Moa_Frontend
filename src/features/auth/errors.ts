const MESSAGES: Record<string, string> = {
  AUTH_EMAIL_NOT_PROVIDED: "소셜 계정에서 이메일을 받지 못했어요. 이메일 제공 동의를 확인해 주세요.",
  AUTH_EMAIL_ALREADY_REGISTERED: "이미 가입된 이메일이에요. 기존에 가입한 소셜 계정으로 로그인해 주세요.",
  AUTH_REJOIN_RESTRICTED: "현재 재가입이 제한된 계정이에요.",
  AUTH_ACCOUNT_SUSPENDED: "이용이 정지된 계정이에요.",
  AUTH_PROVIDER_NOT_SUPPORTED: "지원하지 않는 소셜 로그인이에요.",
  AUTH_SIGNUP_TICKET_INVALID: "가입 정보가 없거나 만료됐어요. 로그인을 다시 시작해 주세요.",
  session: "로그인 세션을 확인하지 못했어요. 다시 로그인해 주세요.",
};
export function getLoginErrorMessage(code?: string, until?: string) {
  if (!code) return null;
  const message = MESSAGES[code] ?? "로그인을 완료하지 못했어요. 다시 시도해 주세요.";
  const date = until ? new Date(until) : null;
  return code === "AUTH_ACCOUNT_SUSPENDED" && date && Number.isFinite(date.getTime())
    ? `${message} 정지 종료: ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(date)}` : message;
}
