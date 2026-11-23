import type { ReactNode } from "react";

import { requireAuthSession } from "@/features/auth/guard";

export const dynamic = "force-dynamic";

export default async function WorkspacesLayout({ children }: { children: ReactNode }) {
  await requireAuthSession();
  return <main className="bg-background min-h-dvh px-5">{children}</main>;
}
