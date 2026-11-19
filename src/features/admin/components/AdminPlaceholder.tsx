import { Construction } from "lucide-react";

/**
 * 관리자 서브 영역 자리표시자 — 셸만 먼저 머지되고 각 영역(회원·신고·방·공지·감사로그) 은
 * 후속 PR 에서 하나씩 채워진다. 그동안 네비 버튼이 깨진 링크처럼 보이지 않도록 **빈 화면 대신
 * 안내 블록** 을 깔아 둔다.
 */

interface AdminPlaceholderProps {
  title: string;
  issue?: string;
}

export function AdminPlaceholder({ title, issue }: AdminPlaceholderProps) {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      </header>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
        <Construction aria-hidden className="h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-600">준비 중인 화면입니다</p>
        <p className="max-w-md text-xs text-slate-400">
          BE 명세는 이미 준비되어 있고, 후속 PR 에서 화면이 채워집니다.
          {issue ? ` (추적: ${issue})` : ""}
        </p>
      </div>
    </div>
  );
}
