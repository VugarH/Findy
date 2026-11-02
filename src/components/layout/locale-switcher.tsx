"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const query = useSearchParams().toString();

  const hrefFor = (locale: Locale) => {
    const rest = pathname.split("/").slice(2).join("/");
    return `/${locale}${rest ? `/${rest}` : ""}${query ? `?${query}` : ""}`;
  };

  const remember = (locale: Locale) => {
    document.cookie = `locale=${locale}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <>
    {/* Phones: a small dropdown, the header row has no room for all three. */}
    <select
      aria-label={label}
      value={current}
      onChange={(event) => {
        const locale = event.target.value as Locale;
        remember(locale);
        router.push(hrefFor(locale));
      }}
      className="h-8 w-[3.25rem] shrink-0 rounded-full border border-line bg-surface pl-2 font-semibold uppercase text-ink md:hidden"
    >
      {LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {locale.toUpperCase()}
        </option>
      ))}
    </select>
    <nav aria-label={label} className="flex items-center max-md:hidden rounded-full border border-line bg-surface p-0.5">
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={hrefFor(locale)}
          hrefLang={locale}
          title={LOCALE_LABELS[locale]}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => remember(locale)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors",
            locale === current ? "bg-ink text-bg" : "text-muted hover:text-ink",
          )}
        >
          {locale}
        </Link>
      ))}
    </nav>
    </>
  );
}
