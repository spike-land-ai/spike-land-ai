import { useState } from "react";

// ─── Shared palette ───────────────────────────────────────────────────────────

const PALETTE = [
  "var(--color-primary)",
  "var(--color-chart-2, #60a5fa)",
  "var(--color-chart-3, #34d399)",
  "var(--color-chart-4, #fbbf24)",
  "var(--color-chart-5, #f87171)",
  "var(--color-muted-foreground)",
];

// ─── LineChart ────────────────────────────────────────────────────────────────

export interface LineChartSeries {
  label: string;
  data: number[];
  color?: string;
}

interface LineChartProps {
  series: LineChartSeries[];
  labels: string[];
  height?: number;
  yAxisLabel?: string;
  className?: string;
}

export function LineChart({
  series,
  labels,
  height = 200,
  yAxisLabel,
  className = "",
}: LineChartProps) {
  const [hovered, setHovered] = useState<{ seriesIdx: number; pointIdx: number } | null>(null);
  const W = 600;
  const H = height;
  const PAD = { top: 16, right: 16, bottom: 32, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const valRange = maxVal - minVal || 1;

  function toX(idx: number, len: number): number {
    return PAD.left + (idx / Math.max(len - 1, 1)) * innerW;
  }
  function toY(v: number): number {
    return PAD.top + innerH - ((v - minVal) / valRange) * innerH;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    val: minVal + t * valRange,
    y: PAD.top + innerH - t * innerH,
  }));

  const xTickCount = Math.min(labels.length, 7);
  const xTickStep = Math.max(1, Math.floor((labels.length - 1) / (xTickCount - 1)));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.min(i * xTickStep, labels.length - 1);
    return { label: labels[idx] ?? "", x: toX(idx, labels.length) };
  });

  return (
    <div
      className={`relative ${className}`}
      role="img"
      aria-label={`Line chart: ${series.map((s) => s.label).join(", ")}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Y gridlines + labels */}
        {yTicks.map(({ val, y }) => (
          <g key={y}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="0.5"
              strokeDasharray="3 3"
            />
            <text
              x={PAD.left - 6}
              y={y}
              textAnchor="end"
              dy="0.35em"
              fontSize="10"
              fill="var(--color-muted-foreground)"
            >
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)}
            </text>
          </g>
        ))}

        {/* Y axis label */}
        {yAxisLabel && (
          <text
            x={12}
            y={H / 2}
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-muted-foreground)"
            transform={`rotate(-90, 12, ${H / 2})`}
          >
            {yAxisLabel}
          </text>
        )}

        {/* X axis labels */}
        {xTicks.map(({ label, x }, i) => (
          <text
            key={i}
            x={x}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-muted-foreground)"
          >
            {label.length > 10 ? label.slice(-8) : label}
          </text>
        ))}

        {/* Series lines + areas */}
        {series.map((s, si) => {
          if (s.data.length < 2) return null;
          const pts = s.data.map((v, i) => `${toX(i, s.data.length)},${toY(v)}`).join(" ");
          const color = s.color ?? PALETTE[si % PALETTE.length];
          const areaClose = `${toX(s.data.length - 1, s.data.length)},${PAD.top + innerH} ${PAD.left},${PAD.top + innerH}`;

          return (
            <g key={s.label}>
              <polygon
                points={`${pts} ${areaClose}`}
                fill={color}
                opacity={0.08}
              />
              <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Hover dots */}
              {s.data.map((v, i) => {
                const isHov = hovered?.seriesIdx === si && hovered.pointIdx === i;
                return (
                  <circle
                    key={i}
                    cx={toX(i, s.data.length)}
                    cy={toY(v)}
                    r={isHov ? 4 : 2}
                    fill={color}
                    opacity={isHov ? 1 : 0}
                    className="transition-opacity"
                    onMouseEnter={() => setHovered({ seriesIdx: si, pointIdx: i })}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Transparent overlay for hover detection */}
        {series[0] && series[0].data.map((_, i) => (
          <rect
            key={i}
            x={toX(i, series[0].data.length) - innerW / (2 * (series[0].data.length - 1 || 1))}
            y={PAD.top}
            width={innerW / Math.max(series[0].data.length - 1, 1)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHovered({ seriesIdx: 0, pointIdx: i })}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
          <div className="font-medium">{labels[hovered.pointIdx]}</div>
          {series.map((s, si) => (
            <div key={si} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color ?? PALETTE[si % PALETTE.length] }}
              />
              {s.label}: {s.data[hovered.pointIdx]}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {series.map((s, si) => (
            <span key={si} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span
                className="inline-block h-2 w-4 rounded"
                style={{ backgroundColor: s.color ?? PALETTE[si % PALETTE.length] }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  height?: number;
  horizontal?: boolean;
  className?: string;
}

export function BarChart({
  data,
  height = 200,
  horizontal = false,
  className = "",
}: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const PAD = { top: 16, right: 16, bottom: horizontal ? 16 : 48, left: horizontal ? 120 : 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    const barH = Math.max(12, Math.floor((innerH / data.length) * 0.65));
    const rowH = innerH / data.length;

    return (
      <div
        className={`relative ${className}`}
        role="img"
        aria-label="Horizontal bar chart"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
          {data.map((item, i) => {
            const barW = (item.value / maxVal) * innerW;
            const y = PAD.top + i * rowH + (rowH - barH) / 2;
            const isHov = hovered === i;
            const color = item.color ?? PALETTE[i % PALETTE.length];
            return (
              <g
                key={item.label}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-default"
              >
                {/* Label */}
                <text
                  x={PAD.left - 8}
                  y={y + barH / 2}
                  textAnchor="end"
                  dy="0.35em"
                  fontSize="10"
                  fill="var(--color-foreground)"
                >
                  {item.label.length > 14 ? `${item.label.slice(0, 13)}…` : item.label}
                </text>
                {/* Bar background */}
                <rect
                  x={PAD.left}
                  y={y}
                  width={innerW}
                  height={barH}
                  rx={barH / 2}
                  fill="var(--color-muted)"
                />
                {/* Bar fill */}
                <rect
                  x={PAD.left}
                  y={y}
                  width={Math.max(barH, barW)}
                  height={barH}
                  rx={barH / 2}
                  fill={color}
                  opacity={isHov ? 1 : 0.8}
                />
                {/* Value label */}
                <text
                  x={PAD.left + Math.max(barH, barW) + 6}
                  y={y + barH / 2}
                  dy="0.35em"
                  fontSize="10"
                  fill="var(--color-muted-foreground)"
                >
                  {item.value.toLocaleString()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Vertical bars
  const barW = Math.max(8, Math.floor((innerW / data.length) * 0.65));
  const colW = innerW / data.length;

  return (
    <div
      className={`relative ${className}`}
      role="img"
      aria-label="Bar chart"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Y gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + innerH - t * innerH;
          const val = t * maxVal;
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
              />
              <text
                x={PAD.left - 6}
                y={y}
                textAnchor="end"
                dy="0.35em"
                fontSize="10"
                fill="var(--color-muted-foreground)"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)}
              </text>
            </g>
          );
        })}

        {data.map((item, i) => {
          const barH = (item.value / maxVal) * innerH;
          const x = PAD.left + i * colW + (colW - barW) / 2;
          const y = PAD.top + innerH - barH;
          const isHov = hovered === i;
          const color = item.color ?? PALETTE[i % PALETTE.length];

          return (
            <g
              key={item.label}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-default"
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, barH)}
                rx={3}
                fill={color}
                opacity={isHov ? 1 : 0.8}
              />
              <text
                x={x + barW / 2}
                y={H - 4}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-muted-foreground)"
              >
                {item.label.length > 8 ? `${item.label.slice(0, 7)}…` : item.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered !== null && (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
          <span className="font-medium">{data[hovered]?.label}</span>:{" "}
          {data[hovered]?.value.toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  centerLabel?: string;
  className?: string;
}

export function DonutChart({
  segments,
  size = 160,
  centerLabel,
  className = "",
}: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-muted-foreground ${className}`}
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const R = 45;
  const r = 28;
  const cx = 50;
  const cy = 50;

  let angle = -Math.PI / 2;

  function slicePath(startAngle: number, endAngle: number, outer: number, inner: number): string {
    const x1 = cx + outer * Math.cos(startAngle);
    const y1 = cy + outer * Math.sin(startAngle);
    const x2 = cx + outer * Math.cos(endAngle);
    const y2 = cy + outer * Math.sin(endAngle);
    const x3 = cx + inner * Math.cos(endAngle);
    const y3 = cy + inner * Math.sin(endAngle);
    const x4 = cx + inner * Math.cos(startAngle);
    const y4 = cy + inner * Math.sin(startAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    return [
      `M ${x1} ${y1}`,
      `A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4}`,
      "Z",
    ].join(" ");
  }

  const slices = segments.map((seg, i) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const startAngle = angle;
    angle += sweep;
    const endAngle = angle;
    const color = seg.color ?? PALETTE[i % PALETTE.length];
    const isHov = hovered === i;
    const outerR = isHov ? R + 3 : R;

    return {
      ...seg,
      path: slicePath(startAngle, endAngle, outerR, r),
      color,
      i,
      midAngle: startAngle + sweep / 2,
    };
  });

  return (
    <div className={`flex flex-col items-center gap-3 sm:flex-row ${className}`}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="shrink-0"
        onMouseLeave={() => setHovered(null)}
        role="img"
        aria-label="Donut chart"
      >
        {slices.map((slice) => (
          <path
            key={slice.label}
            d={slice.path}
            fill={slice.color}
            className="cursor-default transition-all duration-150"
            onMouseEnter={() => setHovered(slice.i)}
          />
        ))}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dy="-0.3em"
          fontSize="10"
          fill="var(--color-foreground)"
          fontWeight="700"
        >
          {hovered !== null ? (segments[hovered]?.value.toLocaleString() ?? total.toLocaleString()) : total.toLocaleString()}
        </text>
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dy="1.1em"
          fontSize="7"
          fill="var(--color-muted-foreground)"
        >
          {hovered !== null
            ? `${(((segments[hovered]?.value ?? 0) / total) * 100).toFixed(1)}%`
            : (centerLabel ?? "total")}
        </text>
      </svg>

      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className={`flex cursor-default items-center gap-1.5 rounded-md px-1 py-0.5 text-xs transition-colors ${
              hovered === i ? "bg-muted" : ""
            }`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color ?? PALETTE[i % PALETTE.length] }}
            />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium text-foreground">{seg.value.toLocaleString()}</span>
            <span className="text-muted-foreground/70">
              ({((seg.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
