import {
  emptyProfile,
  recordInterest,
  sanitizeProfile,
  type InterestEvent,
  type InterestProfile,
} from "@/modules/recommendations/profile";

/**
 * The visitor's interests, kept in this browser's localStorage only
 * (modules/recommendations/profile.ts). Storage can be missing or blocked
 * (private windows), so every access is guarded and failures are ignored.
 */
const KEY = "findy:interests";

export function readInterests(): InterestProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function trackInterest(event: InterestEvent): void {
  try {
    const now = Date.now();
    localStorage.setItem(KEY, JSON.stringify(recordInterest(readInterests() ?? emptyProfile(now), event, now)));
  } catch {
    // Not remembered: recommendations simply stay as they were.
  }
}

export function forgetInterests(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, or storage unavailable.
  }
}
