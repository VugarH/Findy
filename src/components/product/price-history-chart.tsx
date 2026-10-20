"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrencyCode } from "@/config/currencies";
import { useI18n } from "@/i18n/client";
import type { PricePoint } from "@/modules/catalog/offer-view";
import { formatDay } from "@/i18n/format";

interface Props {
  points: PricePoint[];
  currency: CurrencyCode;
  /** The usual (median) price, drawn as a reference line, and how to say it ("Usual price 70 ₼ ($41) at Champion"). */
  usual: { minor: number; label: string } | null;
}

const HEIGHT = 240;
const PAD = { top: 20, right: 16, bottom: 28, left: 60 };
const DAY_MS = 86_400_000;

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const dayString = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/**
 * Step line on a real date axis: a price holds until the day it changes, and
 * days without a check keep the last price. Hovering (or dragging a finger)
 * anywhere shows that day's price; the dots mark the days the price changed.
 */
export function PriceHistoryChart({ points, currency, usual }: Props) {
  const usualMinor = usual?.minor ?? null;
  const { t, money, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chart = useMemo(() => {
    const days = points.map((p) => dayNumber(p.date));
    const first = days[0] ?? 0;
    const last = days[days.length - 1] ?? 0;
    const values = points.map((p) => p.priceMinor);
    if (usualMinor !== null) values.push(usualMinor);
    // Room below the lowest price, so a drop reads as a step down rather than the floor of the chart.
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const ticks = niceTicks(Math.max(0, lo - Math.max((hi - lo) * 0.35, hi * 0.04)), hi);
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (day: number) => PAD.left + (last === first ? innerW / 2 : ((day - first) / (last - first)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min || 1)) * innerH;
    // The price in effect on a day: the latest check on or before it.
    const priceOn = (day: number) => {
      let index = 0;
      for (let i = 0; i < days.length && days[i] <= day; i++) index = i;
      return points[index].priceMinor;
    };
    const changes = points.filter((p, i) => i === 0 || p.priceMinor !== points[i - 1].priceMinor);
    const lowest = Math.min(...points.map((p) => p.priceMinor));
    return { days, first, last, ticks, innerW, x, y, priceOn, changes, lowest };
  }, [points, usualMinor, width]);

  if (points.length < 2) return null;

  const { first, last, ticks, innerW, x, y, priceOn, changes, lowest } = chart;
  const baseline = HEIGHT - PAD.bottom;
  const line = points
    .map((p, i) => (i === 0 ? `M${x(chart.days[0])},${y(p.priceMinor)}` : `H${x(chart.days[i])}V${y(p.priceMinor)}`))
    .join("");
  const area = `${line}V${baseline}H${x(first)}Z`;
  const span = last - first;
  const xLabels = [...new Set([first, Math.round(first + span / 2), last])];

  function dayAt(clientX: number, rect: DOMRect) {
    const ratio = (clientX - rect.left - PAD.left) / innerW;
    return Math.round(first + Math.min(1, Math.max(0, ratio)) * span);
  }

  const shownDay = hoverDay ?? last;
  const shownPrice = priceOn(shownDay);
  const previousPrice = hoverDay !== null ? priceOn(shownDay - 1) : null;
  const tooltipLeft = Math.min(Math.max(x(shownDay), 80), width - 80);

  return (
    <div>
      {usual && (
        <p className="mb-2 flex items-center gap-2 text-xs text-muted">
          <span aria-hidden className="w-5 border-t border-dashed border-muted" />
          {usual.label}
        </p>
      )}
      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t.product.historyTitle}
          onPointerMove={(event) => setHoverDay(dayAt(event.clientX, event.currentTarget.getBoundingClientRect()))}
          onPointerDown={(event) => setHoverDay(dayAt(event.clientX, event.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setHoverDay(null)}
          className="block cursor-crosshair touch-pan-y select-none"
        >
          <defs>
            {/* Fixed to the plot area, so a low stretch still gets a visible fill. */}
            <linearGradient id="price-area" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={PAD.top} y2={baseline}>
              <stop offset="0%" className="[stop-color:var(--chart-line)]" stopOpacity={0.2} />
              <stop offset="100%" className="[stop-color:var(--chart-line)]" stopOpacity={0.08} />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {money(tick, currency)}
              </text>
            </g>
          ))}
          {xLabels.map((day) => (
            <text
              key={day}
              x={x(day)}
              y={HEIGHT - 8}
              textAnchor={day === first ? "start" : day === last ? "end" : "middle"}
              className="fill-muted text-[11px]"
            >
              {formatDay(dayString(day), locale)}
            </text>
          ))}

          <path d={area} fill="url(#price-area)" />
          {usualMinor !== null && (
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(usualMinor)}
              y2={y(usualMinor)}
              strokeDasharray="4 4"
              className="stroke-muted"
            />
          )}
          <path d={line} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="stroke-chart-line" />

          {/* The days the price changed; the lowest price in deal colour. */}
          {changes.map((p) => (
            <circle
              key={p.date}
              cx={x(dayNumber(p.date))}
              cy={y(p.priceMinor)}
              r={3.5}
              strokeWidth={2}
              className={p.priceMinor === lowest ? "fill-deal stroke-surface" : "fill-chart-line stroke-surface"}
            />
          ))}

          {hoverDay !== null && (
            <line x1={x(shownDay)} x2={x(shownDay)} y1={PAD.top} y2={baseline} strokeDasharray="3 3" className="stroke-muted" />
          )}
          <circle cx={x(shownDay)} cy={y(shownPrice)} r={6} strokeWidth={2.5} className="fill-chart-line stroke-surface" />
        </svg>

        <div
          aria-hidden={hoverDay === null}
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-center shadow-card transition-opacity duration-150"
          style={{ left: tooltipLeft, opacity: hoverDay === null ? 0 : 1 }}
        >
          <p className="text-sm font-bold tabular-nums text-ink">
            {money(shownPrice, currency)}
            {previousPrice !== null && previousPrice !== shownPrice && (
              <span className={shownPrice < previousPrice ? "ml-1.5 text-xs text-brand-strong" : "ml-1.5 text-xs text-deal"}>
                {shownPrice < previousPrice ? "↓" : "↑"}
                {Math.abs(Math.round(((shownPrice - previousPrice) / previousPrice) * 100))}%
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted">{formatDay(dayString(shownDay), locale, "long")}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowTable((value) => !value)}
        aria-expanded={showTable}
        className="mt-2 text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        {showTable ? t.product.hideTable : t.product.showTable}
      </button>
      {showTable && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">{t.product.date}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.product.storePrice}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((point) => (
                <tr key={point.date} className="border-t border-line">
                  <td className="px-3 py-1.5">{formatDay(point.date, locale)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(point.priceMinor, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 3–5 round tick values (in minor units) that enclose [lo, hi]. */
function niceTicks(lo: number, hi: number): number[] {
  const span = Math.max(hi - lo, hi * 0.1, 100);
  const rough = span / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let value = start; value < hi + step; value += step) ticks.push(Math.round(value));
  return ticks;
}
