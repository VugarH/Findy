"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface Props {
  /** URL parameter this select controls, e.g. "sort" or "size". */
  param: string;
  label: string;
  value: string;
  /** The first option is the default and is left out of the URL. */
  options: { value: string; label: string }[];
}

/** A dropdown that writes its choice to the URL and returns to page 1. */
export function ParamSelect({ param, label, value, options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const query = new URLSearchParams(searchParams);
    if (next === options[0].value) query.delete(param);
    else query.set(param, next);
    query.delete("page");
    const text = query.toString();
    router.push(text ? `${pathname}?${text}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink"
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
