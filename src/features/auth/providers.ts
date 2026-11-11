import type { SocialProvider } from "@/types/db";

export const SOCIAL_PROVIDER_NAMES = {
  GOOGLE: "구글",
  KAKAO: "카카오",
  NAVER: "네이버",
} as const satisfies Record<SocialProvider, string>;
