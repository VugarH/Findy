"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrencyCode } from "@/config/currencies";
import { LOCALE_TAGS } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import type { PricePoint } from "@/modules/catalog/offer-view";

interface Props {
  points: PricePoint[];
  currency: CurrencyCode;
  /** Median price over the window, drawn as a reference line. */
  usualMinor: number | null;
}

const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

/** Single-series step line: a price holds until the day it changes. */
export function PriceHistoryChart({ points, currency, usualMinor }: Props) {
  const { t, money, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dateLabel = useMemo(() => {
    const format = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "short", timeZone: "UTC" });
    return (iso: string) => format.format(new Date(`${iso}T00:00:00Z`));
  }, [locale]);

  const scale = useMemo(() => {
    const values = points.map((p) => p.priceMinor);
    if (usualMinor !== null) values.push(usualMinor);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const ticks = niceTicks(lo, hi);
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min || 1)) * innerH;
    return { x, y, ticks, innerW };
  }, [points, usualMinor, width]);

  if (points.length < 2) return null;

  const { x, y, ticks, innerW } = scale;
  const line = points
    .map((p, i) => (i === 0 ? `M${x(0)},${y(p.priceMinor)}` : `H${x(i)}V${y(p.priceMinor)}`))
    .join("");
  const baseline = HEIGHT - PAD.bottom;
  const area = `${line}V${baseline}H${x(0)}Z`;
  const last = points.length - 1;
  // With two or three points the middle label coincides with an end one.
  const xLabels = [...new Set([0, Math.floor(last / 2), last])];

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - PAD.left) / innerW;
    setActive(Math.min(last, Math.max(0, Math.round(ratio * last))));
  }

  const shown = active ?? last;
  const tooltipLeft = Math.min(Math.max(x(shown), 70), width - 70);

  return (
    <div>
      {usualMinor !== null && (
        <p className="mb-2 flex items-center gap-2 text-xs text-muted">
          <span aria-hidden className="h-px w-5 bg-muted" />
          {t.product.usualPrice}
          <span className="font-semibold text-ink">{money(usualMinor, currency)}</span>
        </p>
      )}
      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t.product.historyTitle}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          className="block touch-pan-y select-none"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {money(tick, currency)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
              className="fill-muted text-[11px]"
            >
              {dateLabel(points[i].date)}
            </text>
          ))}

          <path d={area} className="fill-chart-line/10" />
          {usualMinor !== null && (
            <line x1={PAD.left} x2={width - PAD.right} y1={y(usualMinor)} y2={y(usualMinor)} className="stroke-muted" />
          )}
          <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-chart-line" />

          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={baseline} className="stroke-muted" />
          )}
          <circle cx={x(shown)} cy={y(points[shown].priceMinor)} r={5} strokeWidth={2} className="fill-chart-line stroke-surface" />
        </svg>

        <div
          aria-hidden={active === null}
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-center shadow-card transition-opacity"
          style={{ left: tooltipLeft, opacity: active === null ? 0 : 1 }}
        >
          <p className="text-sm font-bold text-ink">{money(points[shown].priceMinor, currency)}</p>
          <p className="text-[11px] text-muted">{dateLabel(points[shown].date)}</p>
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
                  <td className="px-3 py-1.5">{dateLabel(point.date)}</td>
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
