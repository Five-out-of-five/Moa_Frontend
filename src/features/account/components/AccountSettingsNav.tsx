"use client";

import { Bell, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SETTINGS_LINKS = [
  { href: "/account", label: "계정 및 프로필", icon: UserRound },
  { href: "/account/settings", label: "알림 설정", icon: Bell },
] as const;

export function AccountSettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="계정 설정" className="flex flex-wrap gap-2 self-start sm:flex-col">
      {SETTINGS_LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm",
            pathname === href && "bg-accent font-medium",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
