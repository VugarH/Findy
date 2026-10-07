"use client";

import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE } from "./theme";

export function ThemeToggle({ label }: { label: string }) {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    // A cookie (not localStorage) so the server renders the right theme with no flash.
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Moon className="when-light size-[18px]" aria-hidden />
      <Sun className="when-dark size-[18px]" aria-hidden />
    </button>
  );
}
