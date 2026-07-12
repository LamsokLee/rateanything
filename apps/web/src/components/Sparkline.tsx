"use client";
import { useId } from "react";
/**
 * Sparkline — Mini trend chart for inline display in tables/cards.
 * Shows score history as a small line, no axes, just the shape.
 * Supports either raw numeric points or full HistoryPoint objects.
 */
interface HistoryPoint {
  timestamp: string;
  avgScore: number;
  count: number;
}
type SparklineData = HistoryPoint | number;
interface SparklineProps {
  data: SparklineData[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  showArea?: boolean;
  showTrendIndicator?: boolean;
}
function normalizeData(data: SparklineData[]): HistoryPoint[] {
  return data.map((d, i) => {
    if (typeof d === "number") {
      return {
        timestamp: new Date(Date.now() - (data.length - 1 - i) * 24 * 60 * 60 * 1000).toISOString(),
        avgScore: d,
        count: 0,
      };
    }
    return d;
  });
}
export function Sparkline({
  data,
  color,
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  className = "",
  showArea = true,
  showTrendIndicator = true,
}: SparklineProps) {
  const normalized = normalizeData(data);
  if (normalized.length < 2) {
    return (
      <span
        className={`inline-block text-[10px] text-subtle/50 ${className}`}
        style={{ width, lineHeight: `${height}px` }}
      >
        —
      </span>
    );
  }
  const scores = normalized.map((d) => d.avgScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore || 1;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const points = normalized.map((d, i) => {
    const x = padding + (i / (normalized.length - 1)) * chartW;
    const y = padding + chartH - ((d.avgScore - minScore) / scoreRange) * chartH;
    return { x, y, score: d.avgScore };
  });
  const linePathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPathD =
    showArea && points.length > 0
      ? `${linePathD} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`
      : null;
  // Trend: compare last point to first
  const firstScore = normalized[0].avgScore;
  const lastScore = normalized[normalized.length - 1].avgScore;
  const trend = lastScore - firstScore;
  const reactId = useId(); const gradientId = `sparkline-gradient${reactId}`;
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {showArea && areaPathD && (
          <path
            d={areaPathD}
            fill={`url(#${gradientId})`}
            stroke="none"
          />
        )}
        {/* Line */}
        <path
          d={linePathD}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
        {/* End dot */}
        <circle
          cx={points[points.length - 1].x.toFixed(1)}
          cy={points[points.length - 1].y.toFixed(1)}
          r={2}
          fill={color}
        />
      </svg>
      {/* Trend indicator */}
      {showTrendIndicator && Math.abs(trend) >= 0.05 && (
        <span
          className={`text-[10px] font-mono ${
            trend > 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {trend > 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}
        </span>
      )}
    </div>
  );
}
