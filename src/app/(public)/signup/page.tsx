import { redirect } from "next/navigation";

import { getAuthReturnPath } from "@/features/auth/return-path";

export default async function SignupEntryPage({ searchParams }: { searchParams: Promise<{ ticket?: string; returnPath?: string }> }) {
  const { ticket, returnPath } = await searchParams;
  if (typeof ticket !== "string" || !ticket || ticket.length > 2048) redirect("/login?error=AUTH_SIGNUP_TICKET_INVALID");
  const next = getAuthReturnPath(returnPath);
  redirect(`/signup/${encodeURIComponent(ticket)}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}
