"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();

  const hrefFor = (locale: Locale) => {
    const rest = pathname.split("/").slice(2).join("/");
    return `/${locale}${rest ? `/${rest}` : ""}${query ? `?${query}` : ""}`;
  };

  return (
    <nav aria-label={label} className="flex items-center rounded-full border border-line bg-surface p-0.5">
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={hrefFor(locale)}
          hrefLang={locale}
          title={LOCALE_LABELS[locale]}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => {
            document.cookie = `locale=${locale}; path=/; max-age=31536000; samesite=lax`;
          }}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors",
            locale === current ? "bg-ink text-bg" : "text-muted hover:text-ink",
          )}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}
