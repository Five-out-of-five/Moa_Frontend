import "server-only";

import { isAuthMock } from "@/features/auth/config";
import { isMock } from "@/mocks/config";

export function getRoomRealtimeConfig() {
  return {
    enabled: !isMock && !isAuthMock,
    url: process.env.NEXT_PUBLIC_WS_URL?.trim() || null,
    local: process.env.NODE_ENV === "development",
  };
}
