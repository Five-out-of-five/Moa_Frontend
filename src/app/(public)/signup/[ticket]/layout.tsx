import { ChartNoAxesColumn } from "lucide-react";
import type { ReactNode } from "react";

export default function SignupLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background grid min-h-dvh place-items-center px-5 py-10 sm:py-14">
      <div className="w-full max-w-md">
        <div className="text-primary mb-9 flex items-center justify-center gap-2 font-bold">
          <span className="bg-primary text-primary-foreground rounded-control grid size-8 place-items-center">
            <ChartNoAxesColumn aria-hidden="true" className="size-5" strokeWidth={3} />
          </span>
          <span>MOA</span>
        </div>
        {children}
      </div>
    </main>
  );
}
