"use client";

import { useEffect } from "react";
import type { InterestEvent } from "@/modules/recommendations/profile";
import { trackInterest } from "./interest-store";

/** The last event remembered: a page shown twice in a row (development, back and forth) counts once. */
let lastRecorded: { key: string; at: number } | null = null;
const REPEAT_MS = 5_000;

/**
 * Remembers one interest when the page is shown (a product opened, a search
 * made). Renders nothing; pages include it only while recommendations are on.
 */
export function InterestTracker({ event }: { event: InterestEvent }) {
  const key = JSON.stringify(event);
  useEffect(() => {
    const now = Date.now();
    if (lastRecorded?.key === key && now - lastRecorded.at < REPEAT_MS) return;
    lastRecorded = { key, at: now };
    trackInterest(JSON.parse(key) as InterestEvent);
  }, [key]);
  return null;
}
