import "server-only";

import { isMock } from "@/mocks/config";
import type { SocialProvider } from "@/types/db";

const SIGNUP_PREVIEW_TICKETS = {
  GOOGLE: "mock-google",
  KAKAO: "mock-kakao",
  NAVER: "mock-naver",
} as const satisfies Record<SocialProvider, string>;

export function getSignupPreviewHref(provider: SocialProvider) {
  return isMock ? `/signup/${SIGNUP_PREVIEW_TICKETS[provider]}` : null;
}

export function getSignupAccount(ticket: string) {
  if (!isMock) return null;

  const providers = Object.keys(SIGNUP_PREVIEW_TICKETS) as SocialProvider[];
  const provider = providers.find((provider) => SIGNUP_PREVIEW_TICKETS[provider] === ticket);

  return provider ? { provider, displayName: "김민준" } : null;
}
