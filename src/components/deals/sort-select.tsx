"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

interface Props {
  /** URL parameter this select controls, e.g. "sort" or "size". */
  param: string;
  label: string;
  value: string;
  /** The first option is the default and is left out of the URL. */
  options: { value: string; label: string }[];
  /** Also remember the choice in this cookie until the browser closes (read by the server). */
  cookie?: string;
  className?: string;
}

/** A dropdown that writes its choice to the URL (and optionally a cookie) and returns to page 1. */
export function ParamSelect({ param, label, value, options, cookie, className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    if (cookie) document.cookie = `${cookie}=${encodeURIComponent(next)}; path=/; samesite=lax`;
    const query = new URLSearchParams(searchParams);
    if (next === options[0].value) query.delete(param);
    else query.set(param, next);
    query.delete("page");
    const text = query.toString();
    router.push(text ? `${pathname}?${text}` : pathname);
  }

  return (
    <label className={cn("flex items-center gap-2 text-sm text-muted", className)}>
      <span className="whitespace-nowrap max-md:sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink max-md:w-full max-md:min-w-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
