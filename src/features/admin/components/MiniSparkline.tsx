/**
 * 미니 스파크라인 — 관리자 대시보드의 시계열 블록에 깔아 두는 라인 차트. 외부 차트 라이브러리
 * (Recharts 등) 없이 SVG 로 직접 그려 **번들 비용 없이** 추이만 전달한다.
 *
 * ⚠️ 색은 slate 계열만 사용. 피크 포인트도 brand/teal 로 강조하지 않는다 — 관리자 영역의
 *    "정적인 톤" 규칙.
 */

interface MiniSparklineProps {
  data: number[];
  height?: number;
  "aria-label"?: string;
}

export function MiniSparkline({
  data,
  height = 48,
  "aria-label": ariaLabel,
}: MiniSparklineProps) {
  if (data.length === 0) {
    return <div className="h-12 w-full rounded-md bg-slate-50" aria-hidden />;
  }

  const width = 240;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = data.length === 1 ? 0 : width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath =
    data.length > 1
      ? `M0,${height} L${points.replace(/\s/g, " L")} L${width},${height} Z`
      : "";

  return (
    <svg
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      className="h-12 w-full"
      preserveAspectRatio="none"
    >
      {areaPath && <path d={areaPath} fill="rgb(241 245 249)" />}
      <polyline
        fill="none"
        stroke="rgb(100 116 139)"
        strokeWidth="1.5"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
