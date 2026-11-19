import { cn } from "@/lib/utils";

/**
 * 관리자 수치 카드 — 대시보드와 각 영역 상단 헤더에 쓰는 재사용 블록.
 *
 * ⚠️ 색 강조는 숫자 자체(`value`) 만으로 전달한다. 테두리·배경·보조선은 전부 slate 로
 *    고정 — 정적인 톤을 유지하기 위함.
 */

interface StatCardProps {
  label: string;
  /** 숫자 혹은 사전 포맷된 문자열. 포맷팅 책임은 호출부에 둔다. */
  value: string;
  hint?: string;
  tone?: "default" | "warning";
}

export function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4",
        tone === "warning" && "border-amber-300 bg-amber-50",
      )}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums",
          tone === "warning" ? "text-amber-800" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}
