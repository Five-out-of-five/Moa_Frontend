import "server-only";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { accounts } from "@/mocks/db";
import type { SocialProvider } from "@/types/db";

import { isAuthMock } from "./config";
import { MOCK_ACCOUNT_IDS } from "./mock-session";

const SIGNUP_PREVIEW_TICKETS = {
  GOOGLE: "mock-google",
  KAKAO: "mock-kakao",
  NAVER: "mock-naver",
} as const satisfies Record<SocialProvider, string>;

export function getSignupPreviewHref(provider: SocialProvider) {
  if (isAuthMock) return `/signup/${SIGNUP_PREVIEW_TICKETS[provider]}`;
  return `/api/auth/login/${provider.toLowerCase()}`;
}

export async function getSignupAccount(ticket: string): Promise<{ provider: SocialProvider; displayName: string } | null> {
  if (!isAuthMock) {
    const data = await api<{ provider: string; email: string; name: string }>(
      `/api/v1/auth/signup-tickets/${encodeURIComponent(ticket)}`, { cache: "no-store" },
    ).catch((error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SIGNUP_TICKET_INVALID") return null;
      throw error;
    });
    if (!data) return null;
    const provider = data.provider.toUpperCase();
    if (provider !== "GOOGLE" && provider !== "KAKAO" && provider !== "NAVER") return null;
    return { provider, displayName: data.name };
  }

  const providers = Object.keys(SIGNUP_PREVIEW_TICKETS) as SocialProvider[];
  const provider = providers.find((provider) => SIGNUP_PREVIEW_TICKETS[provider] === ticket);

  const account = provider ? accounts.find(({ id }) => id === MOCK_ACCOUNT_IDS[provider]) : null;
  return provider && account ? { provider, displayName: account.name } : null;
}
