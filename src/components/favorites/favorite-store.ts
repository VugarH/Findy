"use client";

import { useSyncExternalStore } from "react";
import { FAVORITES_LIMIT, sanitizeFavorites } from "@/modules/favorites/items";

/**
 * Favorites, kept in this browser's localStorage like the cart: no account
 * needed. Every component reads them through useFavorites(), so all of them
 * update together (also across tabs).
 */

const KEY = "serfeli:favorites";
const CHANGED = "serfeli:favorites-changed";

const EMPTY: string[] = [];
let cached: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: no favorites.
  }
  if (raw !== cached.raw) {
    let parsed: unknown = [];
    try {
      parsed = raw ? JSON.parse(raw) : [];
    } catch {
      // A damaged value starts a new list.
    }
    cached = { raw, ids: sanitizeFavorites(parsed) };
  }
  return cached.ids;
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => event.key === KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** Saved product ids, newest first. Empty on the server and during hydration. */
export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const favorites = {
  /** Saves or unsaves a product. A full list drops its oldest entry. */
  toggle(productId: string) {
    const ids = read();
    write(ids.includes(productId) ? ids.filter((id) => id !== productId) : [productId, ...ids].slice(0, FAVORITES_LIMIT));
  },
  remove(...productIds: string[]) {
    write(read().filter((id) => !productIds.includes(id)));
  },
};
