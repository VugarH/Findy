"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  max: number;
  step: number;
  anyLabel: string;
  /** Template with {pct}, e.g. "{pct}% or more". */
  atLeastLabel: string;
  ariaLabel: string;
}

/** Minimum-discount slider. The URL updates once the thumb rests, not on every pixel. */
export function DiscountSlider({ value, max, step, anyLabel, atLeastLabel, ariaLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow the URL when the filter is changed elsewhere (a chip removed, filters cleared).
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(next: number) {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = new URLSearchParams(searchParams);
      if (next > 0) query.set("discount", String(next));
      else query.delete("discount");
      query.delete("page");
      const text = query.toString();
      router.push(text ? `${pathname}?${text}` : pathname, { scroll: false });
    }, 350);
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">
        {draft > 0 ? atLeastLabel.replace("{pct}", String(draft)) : anyLabel}
      </p>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={Math.min(draft, max)}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-brand"
      />
      <div className="mt-1 flex justify-between text-xs text-muted tabular-nums">
        <span>0%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}
