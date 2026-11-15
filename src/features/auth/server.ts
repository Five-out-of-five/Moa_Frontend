import "server-only";

import { isMock } from "@/mocks/config";
import { accounts } from "@/mocks/db";
import type { SocialProvider } from "@/types/db";

import { MOCK_ACCOUNT_IDS } from "./mock-session";

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

  const account = provider ? accounts.find(({ id }) => id === MOCK_ACCOUNT_IDS[provider]) : null;
  return provider && account ? { provider, displayName: account.name } : null;
}
