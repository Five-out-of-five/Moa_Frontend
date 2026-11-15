"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isMock } from "@/mocks/config";

import { getInviteReturnPath, MOCK_ACCOUNT_COOKIE, MOCK_ACCOUNT_IDS } from "./mock-session";
import { getSignupAccount } from "./server";

export async function completeMockSignupAction(
  ticket: string,
  next: string | undefined,
  data: FormData,
) {
  const account = isMock ? getSignupAccount(ticket) : null;
  if (!account || data.get("terms") !== "on" || data.get("privacy") !== "on") redirect("/login");
  (await cookies()).set(MOCK_ACCOUNT_COOKIE, String(MOCK_ACCOUNT_IDS[account.provider]), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(getInviteReturnPath(next) ?? "/workspaces");
}
