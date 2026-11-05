"use client";

import { useSyncExternalStore } from "react";
import { setAnalyticsIgnoredAction } from "@/modules/admin/actions/general";
import { NO_ANALYTICS_COOKIE } from "@/modules/analytics/exclusions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ActionButton } from "./action-button";
import { useAdminT } from "./admin-i18n";

/** Users page: leave this account's visits out of Analytics, or count them again. */
export function IgnoreUserButton({ userId, ignored }: { userId: string; ignored: boolean }) {
  const t = useAdminT();
  return (
    <ActionButton action={setAnalyticsIgnoredAction} fields={{ id: userId, ignore: String(!ignored) }} variant="ghost">
      {ignored ? t.users.countInAnalytics : t.users.ignoreInAnalytics}
    </ActionButton>
  );
}

const CHANGED = "findy:no-analytics-changed";
const read = () => document.cookie.split(";").some((part) => part.trim() === `${NO_ANALYTICS_COOKIE}=1`);
const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
};

/**
 * Analytics page: stop counting this browser, also when signed out (the team's
 * own phone or laptop). A cookie that stays for a year; it is read on the server.
 */
export function ThisBrowserToggle() {
  const t = useAdminT();
  const off = useSyncExternalStore(subscribe, read, () => false);
  const set = (ignore: boolean) => {
    document.cookie = `${NO_ANALYTICS_COOKIE}=${ignore ? "1" : "0"}; path=/; max-age=${ignore ? 31536000 : 0}; samesite=lax; secure`;
    window.dispatchEvent(new Event(CHANGED));
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm">{off ? t.analytics.browserIgnored : t.analytics.browserCounted}</p>
      <button type="button" onClick={() => set(!off)} className={cn(buttonClass({ variant: "secondary", size: "sm" }), "h-8 px-3 text-xs")}>
        {off ? t.analytics.countBrowser : t.analytics.ignoreBrowser}
      </button>
    </div>
  );
}
