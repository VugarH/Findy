"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { Container } from "@/components/ui/container";

/**
 * Pages seen in this tab. Kept in sessionStorage because a language change
 * loads the page anew (another root layout) and would forget module state.
 */
const PAGES_KEY = "findy:pages-seen";
let pagesSeenHere = 0;
let lastPath: string | null = null;

function pagesSeen(): number {
  try {
    return Number(sessionStorage.getItem(PAGES_KEY)) || pagesSeenHere;
  } catch {
    return pagesSeenHere;
  }
}

/** A reload of the same page is not a page to go back to. */
function countPage(pathname: string) {
  const path = pathname.split("/").slice(2).join("/");
  try {
    if (sessionStorage.getItem(`${PAGES_KEY}:last`) === path) return;
    sessionStorage.setItem(`${PAGES_KEY}:last`, path);
  } catch {
    // Counted below as before.
  }
  pagesSeenHere = pagesSeen() + 1;
  try {
    sessionStorage.setItem(PAGES_KEY, String(pagesSeenHere));
  } catch {
    // Storage blocked: the count lives until the next full load.
  }
}

/** Shows the current page in the language last chosen, if it is in another. */
function followChosenLanguage(replace: (href: string) => void) {
  const saved = document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1];
  const [, shown, ...rest] = window.location.pathname.split("/");
  if (saved && isLocale(saved) && isLocale(shown) && saved !== shown) {
    replace(`/${[saved, ...rest].join("/")}${window.location.search}`);
  }
}

/** Pages (without the language) seen in this tab, most recent last. */
const SEEN_KEY = "findy:seen-paths";

function seenPaths(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function seenBefore(path: string): boolean {
  return seenPaths().includes(path);
}

function remember(path: string) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seenPaths().filter((p) => p !== path), path].slice(-50)));
  } catch {
    // Storage blocked: pages keep the language in their address.
  }
}

/** Deal listings (/deals, /category/…) and conversations (/messages/…) show their own way back. */
function hasOwnBackLink(pathname: string, href: (path: string) => string): boolean {
  return pathname === href("/deals") || pathname.startsWith(href("/category/")) || pathname.startsWith(href("/messages/"));
}

/**
 * "← Back" above every page except the home page and the deal listings. It goes to the previous
 * page on our site; opened straight from a link (Telegram, a shared URL) it
 * goes home instead of leaving the site.
 */
export function BackButton() {
  const { t, href } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Back to a page seen before a language change: show it in the language chosen since.
    // A page opened from outside (a shared /en/ link) was not seen in this tab and keeps its language.
    const path = pathname.split("/").slice(2).join("/");
    if (seenBefore(path)) followChosenLanguage(router.replace);
    remember(path);
  }, [pathname, router]);

  useEffect(() => {
    // Counted per address, so an effect that runs twice (React's development check) counts once.
    if (pathname !== lastPath) {
      lastPath = pathname;
      countPage(pathname);
    }
  }, [pathname]);

  if (pathname === href("/") || pathname === "/" || hasOwnBackLink(pathname, href)) return null;

  return (
    <Container className="pt-2 md:pt-4">
      <button
        type="button"
        onClick={() => (pagesSeen() > 1 ? router.back() : router.push(href("/")))}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 -ml-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.nav.back}
      </button>
    </Container>
  );
}
