"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-reads the page now and then while it is in view, so new messages show up
 * without reloading. `now`: once right away too, e.g. after opening an unread
 * thread, so the unread badge rendered next to it catches up.
 */
export function LiveRefresh({ everyMs = 20_000, now = false }: { everyMs?: number; now?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (now) router.refresh();
  }, [router, now]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);
  return null;
}
