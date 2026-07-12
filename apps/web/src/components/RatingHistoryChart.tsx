"use client";

/**
 * RatingHistoryChart — Time-series focused financial chart.
 * Hero visual for the topic page: 300px tall, clean gridlines,
 * date labels on X-axis, time controls below, crosshair tooltip.
 */
import { useState, useRef } from "react";
import { CHART_COLORS } from "@/lib/chart-colors";

interface HistoryPoint {
  timestamp: string;
  avgScore: number;
  count: number;
}

interface OptionHistory {
  optionId: string;
  optionName: string;
  history: HistoryPoint[];
}

interface RatingHistoryChartProps {
  data: OptionHistory[];
}

type TimeRange = "7D" | "14D" | "30D" | "All";

interface CrosshairData {
  x: number;
  svgX: number;
  values: { name: string; score: number; color: string }[];
  date: string;
}

export function RatingHistoryChart({ data }: RatingHistoryChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30D");
  const [crosshair, setCrosshair] = useState<CrosshairData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const validOptions = data.filter((opt) => opt.history.length >= 2);

  if (validOptions.length === 0) {
    return (
      <div className="space-y-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-subtle">
          Score History
        </span>
        <p className="text-sm text-subtle text-center py-10">
          Not enough voting history yet — check back after more votes!
        </p>
      </div>
    );
  }

  const now = Date.now();
  const rangeMs: Record<TimeRange, number> = {
    "7D": 7 * 24 * 60 * 60 * 1000,
    "14D": 14 * 24 * 60 * 60 * 1000,
    "30D": 30 * 24 * 60 * 60 * 1000,
    All: Infinity,
  };

  const cutoff = rangeMs[timeRange] === Infinity ? 0 : now - rangeMs[timeRange];

  const filteredOptions = validOptions
    .map((opt) => ({
      ...opt,
      history: opt.history.filter(
        (p) => new Date(p.timestamp).getTime() >= cutoff
      ),
    }))
    .filter((opt) => opt.history.length >= 2);

  const allTimestamps: number[] = [];
  for (const opt of filteredOptions) {
    for (const point of opt.history) {
      allTimestamps.push(new Date(point.timestamp).getTime());
    }
  }

  if (allTimestamps.length === 0) {
    return (
      <div className="space-y-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-subtle">
          Score History
        </span>
        <p className="text-sm text-subtle text-center py-10">
          No data in selected time range
        </p>
      </div>
    );
  }

  const minTime = Math.min(...allTimestamps);
  const maxTime = Math.max(...allTimestamps);
  const timeSpan = maxTime - minTime || 1;

  // Chart dimensions — 300px tall hero chart
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 36, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const scaleX = (t: number) => padding.left + ((t - minTime) / timeSpan) * chartW;
  const scaleY = (score: number) => padding.top + chartH - ((score - 1) / 9) * chartH;

  // Y-axis gridlines at 1, 3, 5, 7, 9
  const yGridLines = [1, 3, 5, 7, 9];

  // X-axis date labels
  const xLabelCount = 6;
  const xLabels: { time: number; label: string }[] = [];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < xLabelCount; i++) {
    const t = minTime + (i / (xLabelCount - 1)) * timeSpan;
    const d = new Date(t);
    xLabels.push({
      time: t,
      label: `${months[d.getUTCMonth()]} ${d.getUTCDate()}`,
    });
  }

  // Build polyline paths
  const optionPaths = filteredOptions
    .map((opt, optIdx) => {
      const color = CHART_COLORS[optIdx % CHART_COLORS.length];
      const points = opt.history
        .filter((p) => p.avgScore > 0)
        .map((p) => ({
          x: scaleX(new Date(p.timestamp).getTime()),
          y: scaleY(p.avgScore),
          time: new Date(p.timestamp).getTime(),
          score: p.avgScore,
        }))
        .sort((a, b) => a.x - b.x);

      if (points.length < 2) return null;

      const pathD = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");

      return { optionName: opt.optionName, color, points, pathD };
    })
    .filter(Boolean) as {
    optionName: string;
    color: string;
    points: { x: number; y: number; time: number; score: number }[];
    pathD: string;
  }[];

  // Handle mouse move for crosshair
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgScale = width / rect.width;
    const svgMouseX = mouseX * svgScale;

    if (svgMouseX < padding.left || svgMouseX > width - padding.right) {
      setCrosshair(null);
      return;
    }

    const timeAtX = minTime + ((svgMouseX - padding.left) / chartW) * timeSpan;
    const dateAtX = new Date(timeAtX);
    const dateStr = `${months[dateAtX.getUTCMonth()]} ${dateAtX.getUTCDate()}`;

    const values: { name: string; score: number; color: string }[] = [];
    for (const optPath of optionPaths) {
      let closest = optPath.points[0];
      let closestDist = Math.abs(closest.time - timeAtX);
      for (const p of optPath.points) {
        const dist = Math.abs(p.time - timeAtX);
        if (dist < closestDist) {
          closest = p;
          closestDist = dist;
        }
      }
      values.push({ name: optPath.optionName, score: closest.score, color: optPath.color });
    }

    values.sort((a, b) => b.score - a.score);
    setCrosshair({ x: mouseX, svgX: svgMouseX, values, date: dateStr });
  };

  const handleMouseLeave = () => setCrosshair(null);

  // Latest scores for legend
  const latestScores: Record<string, number> = {};
  for (const opt of filteredOptions) {
    const sorted = [...opt.history].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    if (sorted.length > 0) {
      latestScores[opt.optionName] = sorted[0].avgScore;
    }
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-subtle">
          Score History
        </span>
        <span className="text-[10px] text-subtle/70">
          — cumulative average over time
        </span>
      </div>

      {/* Chart — 300px hero */}
      <div ref={containerRef} className="relative w-full" style={{ height: "300px" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Y-axis grid lines — very faint */}
          {yGridLines.map((v) => (
            <g key={v}>
              <line
                x1={padding.left}
                y1={scaleY(v)}
                x2={width - padding.right}
                y2={scaleY(v)}
                stroke="#27272a"
                strokeWidth={0.5}
                opacity={0.6}
              />
              <text
                x={padding.left - 10}
                y={scaleY(v) + 3.5}
                textAnchor="end"
                fill="#52525b"
                fontSize={10}
                fontFamily="ui-monospace, monospace"
              >
                {v}
              </text>
            </g>
          ))}

          {/* X-axis date labels */}
          {xLabels.map((label, i) => (
            <text
              key={i}
              x={scaleX(label.time)}
              y={height - 10}
              textAnchor="middle"
              fill="#52525b"
              fontSize={10}
              fontFamily="ui-monospace, monospace"
            >
              {label.label}
            </text>
          ))}

          {/* Option lines — 2.5px stroke, rounded */}
          {optionPaths.map((optPath, idx) => (
            <path
              key={idx}
              d={optPath.pathD}
              fill="none"
              stroke={optPath.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          ))}

          {/* Crosshair vertical line */}
          {crosshair && (
            <line
              x1={crosshair.svgX}
              y1={padding.top}
              x2={crosshair.svgX}
              y2={height - padding.bottom}
              stroke="#3f3f46"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Dots at crosshair intersection */}
          {crosshair &&
            crosshair.values.map((v, i) => (
              <circle
                key={i}
                cx={crosshair.svgX}
                cy={scaleY(v.score)}
                r={4}
                fill={v.color}
                stroke="#09090b"
                strokeWidth={2}
              />
            ))}
        </svg>

        {/* Crosshair tooltip */}
        {crosshair && (
          <div
            className="absolute pointer-events-none z-10 rounded border border-input/80 bg-card/95 backdrop-blur-sm px-3 py-2 text-[11px] whitespace-nowrap max-w-[80vw] overflow-hidden"
            style={{
              left: Math.min(Math.max(crosshair.x + 14, 0), (containerRef.current?.clientWidth ?? 400) - 200),
              top: 12,
            }}
          >
            <div className="text-muted-foreground mb-1.5 font-mono text-[10px]">{crosshair.date}</div>
            {crosshair.values.map((v, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: v.color }}
                />
                <span className="text-foreground/80">{v.name}</span>
                <span className="font-mono font-bold text-foreground ml-auto pl-3">
                  {v.score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time controls — BELOW the chart */}
      <div className="flex items-center gap-1">
        {(["7D", "14D", "30D", "All"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors duration-150 ${
              timeRange === range
                ? "bg-muted-foreground text-foreground"
                : "text-subtle hover:text-foreground/80 hover:bg-muted/60"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Legend — colored dots + option name + current score, horizontally wrapped */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {optionPaths.map((optPath, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: optPath.color }}
            />
            <span className="text-xs text-muted-foreground">{optPath.optionName}</span>
            <span className="text-xs font-mono font-semibold text-foreground/80">
              {(latestScores[optPath.optionName] ?? 0).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
