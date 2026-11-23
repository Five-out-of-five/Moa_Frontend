import { redirect } from "next/navigation";

import { getAuthReturnPath } from "@/features/auth/return-path";

export default async function LegacySignupPage({ params, searchParams }: { params: Promise<{ ticket: string }>; searchParams: Promise<{ next?: string; returnPath?: string }> }) {
  const { ticket } = await params;
  const query = await searchParams;
  if (!ticket || ticket.length > 2048) redirect("/login?error=AUTH_SIGNUP_TICKET_INVALID");
  const returnPath = getAuthReturnPath(query.returnPath ?? query.next);
  const destination = new URLSearchParams({ ticket });
  if (returnPath) destination.set("returnPath", returnPath);
  redirect(`/signup?${destination}`);
}
