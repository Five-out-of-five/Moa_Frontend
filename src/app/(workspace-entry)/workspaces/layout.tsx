import type { ReactNode } from "react";

export default function WorkspacesLayout({ children }: { children: ReactNode }) {
  return <main className="bg-background min-h-dvh px-5">{children}</main>;
}
