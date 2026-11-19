"use client";

import {
  Bell,
  Flag,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * 관리자 좌측 네비 — 메인 사이트의 전역 사이드바(`components/common/Sidebar.tsx`) 와 자리만
 * 같고 성격은 다르다. 메인은 피처(채팅 등) 가 자기 리스트를 소유하지만, 관리자는 "6개 영역
 * 바로가기" 가 전부라 **정적 메뉴**로 충분하다.
 *
 * ⚠️ 색은 `brand` / `teal` 강조를 피하고 **slate 계열** 로만 통일 — 관리자 영역을 "정적이고
 *    단정한 톤" 으로 유지하기 위한 규칙이다. 이걸 깨면 메인 사이트와 관리자 영역이
 *    톤상 뒤섞여 보인다.
 */

interface NavItem {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  /** `/admin` 처럼 중첩 경로에도 활성 표시를 유지할지. 기본 true. */
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/admin", label: "대시보드", Icon: LayoutDashboard, exact: true },
  { href: "/admin/accounts", label: "회원 관리", Icon: Users },
  { href: "/admin/reports", label: "신고 관리", Icon: Flag },
  { href: "/admin/rooms", label: "방 관리", Icon: ShieldCheck },
  { href: "/admin/notices", label: "공지 관리", Icon: Bell },
  { href: "/admin/audit-logs", label: "감사 로그", Icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="관리자 메뉴"
      className="flex h-full flex-col gap-1 border-r border-slate-200 bg-white px-3 py-5"
    >
      <div className="mb-3 px-3">
        <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Admin
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-700">운영 콘솔</p>
      </div>

      <ul className="flex flex-col gap-0.5">
        {ITEMS.map(({ href, label, Icon, exact = false }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-white" : "text-slate-400 group-hover:text-slate-600",
                  )}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
