"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Container } from "@/components/ui/container";

/** Pages seen in this tab since the site loaded; module state survives client navigation. */
let pagesSeen = 0;
let lastPath: string | null = null;

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
    // Counted per address, so an effect that runs twice (React's development check) counts once.
    if (pathname !== lastPath) {
      lastPath = pathname;
      pagesSeen++;
    }
  }, [pathname]);

  if (pathname === href("/") || pathname === "/" || hasOwnBackLink(pathname, href)) return null;

  return (
    <Container className="pt-4">
      <button
        type="button"
        onClick={() => (pagesSeen > 1 ? router.back() : router.push(href("/")))}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 -ml-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.nav.back}
      </button>
    </Container>
  );
}
