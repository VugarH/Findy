"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

/** The first page of this tab's visit says where it came from; later page changes do not. */
let landing = true;
let lastPath: string | null = null;

/**
 * Counts page views for Admin → Analytics: the page address, and on the first
 * page where the visitor came from. No cookies; see modules/analytics.
 */
export function PageTracker() {
  const pathname = usePathname();
  const { locale } = useI18n();

  useEffect(() => {
    // Once per address (React runs effects twice while developing).
    if (pathname === lastPath) return;
    lastPath = pathname;
    const params = new URLSearchParams(window.location.search);
    const payload = JSON.stringify({
      path: pathname,
      locale,
      landing,
      referrer: landing ? document.referrer || null : null,
      utmSource: landing ? params.get("utm_source") : null,
    });
    landing = false;
    if (!navigator.sendBeacon?.("/api/track", new Blob([payload], { type: "application/json" }))) {
      void fetch("/api/track", { method: "POST", body: payload, keepalive: true }).catch(() => undefined);
    }
  }, [pathname, locale]);

  return null;
}
