import type { ReactNode } from "react";

/**
 * One number per day as thin bars on a single axis, with the peak marked.
 * Hovering a bar shows its day and value. Server-rendered SVG, no library.
 */
export function DayBars({
  title,
  points,
  color,
  dayLabel,
}: {
  title: ReactNode;
  points: { day: string; value: number }[];
  /** A CSS colour, e.g. "var(--brand)". */
  color: string;
  dayLabel: (day: string) => string;
}) {
  const width = 600;
  const height = 140;
  const top = 14;
  const max = Math.max(1, ...points.map((point) => point.value));
  const slot = width / points.length;
  const bar = Math.max(2, Math.min(18, slot - 2));

  return (
    <figure className="rounded-2xl border border-line bg-surface p-5">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-bold">{title}</span>
        <span className="text-xs tabular-nums text-muted">max {max}</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height + 18}`} className="h-auto w-full" role="img" aria-label={String(title)}>
        <line x1={0} x2={width} y1={height} y2={height} stroke="var(--line)" strokeWidth={1} />
        <line x1={0} x2={width} y1={top} y2={top} stroke="var(--line)" strokeWidth={1} strokeDasharray="3 4" />
        {points.map((point, index) => {
          const h = point.value === 0 ? 0 : Math.max(2, ((height - top) * point.value) / max);
          const x = index * slot + (slot - bar) / 2;
          return (
            <g key={point.day}>
              {/* The whole column answers to hover, not only the bar. */}
              <rect x={index * slot} y={0} width={slot} height={height} fill="transparent">
                <title>{`${dayLabel(point.day)}: ${point.value}`}</title>
              </rect>
              {h > 0 && (
                <rect x={x} y={height - h} width={bar} height={h} rx={Math.min(3, bar / 2)} fill={color} pointerEvents="none" />
              )}
            </g>
          );
        })}
        <text x={0} y={height + 14} fontSize={11} fill="var(--muted)">
          {dayLabel(points[0].day)}
        </text>
        <text x={width} y={height + 14} fontSize={11} fill="var(--muted)" textAnchor="end">
          {dayLabel(points.at(-1)!.day)}
        </text>
      </svg>
    </figure>
  );
}
