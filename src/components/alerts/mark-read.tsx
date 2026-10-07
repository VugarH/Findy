"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/modules/alerts/actions";

/** Opening the alerts page counts as having seen the notifications. */
export function MarkNotificationsRead({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (enabled) void markNotificationsReadAction();
  }, [enabled]);
  return null;
}
