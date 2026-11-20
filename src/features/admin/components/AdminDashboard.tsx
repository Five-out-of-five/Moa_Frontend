import { AlertTriangle } from "lucide-react";

import { aiFeatureLabel } from "../lib/ai-feature";
import { getAiUsageStats, getStatsOverview } from "../server";
import type { StatsRangeQuery, StatsSeriesPoint } from "../types";
import { MiniSparkline } from "./MiniSparkline";
import { StatCard } from "./StatCard";

/**
 * 관리자 대시보드 — 두 로더(`stats/overview`, `stats/ai-usage`) 를 `Promise.allSettled` 로
 * **각각 독립적으로** 가져온다. 한쪽이 실패해도 다른 블록은 그대로 보여주는 게 관리자 화면의
 * 1원칙 — 운영 지표가 반쪽이라도 보이는 게, 둘 다 404 공백보다 복구에 유리하다.
 *
 * ⚠️ 날짜·시간은 **Asia/Seoul 고정**. 서버 로컬 TZ 에 기대지 않는다 — UTC 서버에서 한국 운영자가
 *    보면 9시간 어긋나기 때문. 14일 범위 계산도 KST 달력 날짜 기준으로 해서 DST 전환 영향 받지
 *    않도록 한다.
 */

const TZ = "Asia/Seoul";
const TZ_LABEL = "KST";

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatMoney(amount: number): string {
  return `$ ${amount.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatKstDateTime(iso: string): string {
  // yyyy-MM-dd HH:mm (KST) — sv-SE locale 가 ISO 스타일로 맞춰 준다.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatKstDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * KST 달력 날짜 기준으로 `today` 부터 13일 전까지, 양 끝 포함 14일 범위를 돌려준다.
 * 밀리초 차감이 아니라 Date 생성자에 `d - 13` 을 넣어 **월 경계를 넘어가도 정상 롤오버** 하도록
 * 한다. UTC 자정 기준 Date 를 만들어 Intl 포맷으로 KST 날짜만 떼낸다.
 */
function defaultRange(): StatsRangeQuery {
  const now = new Date();
  // KST 오늘 날짜 (yyyy-MM-dd)
  const todayStr = formatKstDate(now);
  const [y, m, d] = todayStr.split("-").map(Number);
  // UTC 자정으로 Date 를 만들어 산술 → Intl 로 다시 KST 날짜 추출.
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const fromUtc = new Date(Date.UTC(y, m - 1, d - 13));
  return {
    unit: "DAY",
    from: formatKstDate(fromUtc),
    to: formatKstDate(todayUtc),
  };
}

/** `periodStart` 오름차순 정렬 복사본. 원본 배열은 건드리지 않는다. */
function sortSeries(series: StatsSeriesPoint[] | undefined): StatsSeriesPoint[] {
  if (!series) return [];
  return [...series].sort((a, b) =>
    (a.periodStart ?? "").localeCompare(b.periodStart ?? ""),
  );
}

export async function AdminDashboard() {
  const range = defaultRange();
  const [overviewResult, aiResult] = await Promise.allSettled([
    getStatsOverview(range),
    getAiUsageStats(range),
  ]);

  const overview =
    overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const ai = aiResult.status === "fulfilled" ? aiResult.value : null;

  const sortedSeries = sortSeries(overview?.series);
  const totals = overview?.totals;
  const hasTotals = Boolean(
    totals && (totals.accounts !== undefined ||
      totals.rooms !== undefined ||
      totals.messages !== undefined),
  );
  const hasSeries = sortedSeries.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          서비스 전체 지표 · 최근 14일 (일별 집계 · {TZ_LABEL})
        </p>
      </header>

      {/* 서비스 전체 지표 */}
      <section aria-labelledby="overview-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="overview-heading" className="text-sm font-semibold text-slate-700">
            전체 지표
          </h2>
          {overview?.aggregatedAt && (
            <span className="text-xs text-slate-400">
              집계 시각 · {formatKstDateTime(overview.aggregatedAt)} {TZ_LABEL}
            </span>
          )}
        </div>

        {overview ? (
          <>
            {hasTotals ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  label="누적 회원"
                  value={formatNumber(totals?.accounts ?? 0)}
                />
                <StatCard
                  label="누적 방"
                  value={formatNumber(totals?.rooms ?? 0)}
                />
                <StatCard
                  label="누적 메시지"
                  value={formatNumber(totals?.messages ?? 0)}
                />
              </div>
            ) : (
              <EmptyBlock label="집계 데이터가 없습니다." />
            )}

            {hasSeries ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <SparklineBlock
                  label="신규 회원 추이"
                  points={sortedSeries.map((p) => p.newAccounts ?? 0)}
                />
                <SparklineBlock
                  label="활성 회원 추이"
                  points={sortedSeries.map((p) => p.activeAccounts ?? 0)}
                />
                <SparklineBlock
                  label="메시지 추이"
                  points={sortedSeries.map((p) => p.messages ?? 0)}
                />
              </div>
            ) : (
              <EmptyBlock label="추이 데이터가 없습니다." />
            )}
          </>
        ) : (
          <EmptyBlock label="전체 지표를 불러오지 못했습니다." />
        )}
      </section>

      {/* AI 사용량 */}
      <section aria-labelledby="ai-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="ai-heading" className="text-sm font-semibold text-slate-700">
            AI 사용량
          </h2>
          {ai?.threshold && (
            <span className="text-xs text-slate-400">
              한도 · {formatMoney(ai.threshold.costAmount ?? 0)} ({ai.threshold.exceeded ? "초과" : "정상"})
            </span>
          )}
        </div>

        {ai ? (
          <>
            {ai.threshold?.exceeded && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle aria-hidden className="h-4 w-4" />
                이번 기간 AI 비용이 설정 한도를 넘었습니다.
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">기능</th>
                    <th className="px-4 py-2.5 text-right font-medium">호출</th>
                    <th className="px-4 py-2.5 text-right font-medium">실패</th>
                    <th className="px-4 py-2.5 text-right font-medium">프롬프트 토큰</th>
                    <th className="px-4 py-2.5 text-right font-medium">출력 토큰</th>
                    <th className="px-4 py-2.5 text-right font-medium">비용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(ai.byFeature ?? []).map((row) => {
                    const fail = row.failedCalls ?? 0;
                    const calls = row.calls ?? 0;
                    const failRateHigh = calls > 0 && fail / calls > 0.03;
                    return (
                      <tr key={row.feature}>
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {aiFeatureLabel(row.feature)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatNumber(calls)}
                        </td>
                        <td
                          className={
                            failRateHigh
                              ? "px-4 py-2.5 text-right text-amber-700 tabular-nums"
                              : "px-4 py-2.5 text-right tabular-nums"
                          }
                        >
                          {formatNumber(fail)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                          {formatNumber(row.promptTokens ?? 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                          {formatNumber(row.outputTokens ?? 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatMoney(row.costAmount ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                  {(ai.byFeature ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                        이번 기간에 AI 호출이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyBlock label="AI 사용량을 불러오지 못했습니다." />
        )}
      </section>
    </div>
  );
}

function SparklineBlock({ label, points }: { label: string; points: number[] }) {
  const latest = points[points.length - 1] ?? 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-800 tabular-nums">
          {formatNumber(latest)}
        </p>
      </div>
      <div className="mt-2">
        <MiniSparkline data={points} aria-label={`${label} 14일 추이`} />
      </div>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}
