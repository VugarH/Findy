"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const DrawerContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function useDrawer() {
  const value = useContext(DrawerContext);
  if (!value) throw new Error("Filter drawer components must be inside <FilterDrawerProvider>");
  return value;
}

/**
 * On wide screens the filters are a sidebar. On phones the same panel slides
 * in from the right; it stays open while filters are tapped, so several can be
 * set before looking at the results.
 */
export function FilterDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return <DrawerContext.Provider value={{ open, setOpen }}>{children}</DrawerContext.Provider>;
}

export function FilterDrawerButton({ label, activeCount }: { label: string; activeCount: number }) {
  const { setOpen } = useDrawer();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-ink md:hidden"
    >
      <SlidersHorizontal className="size-4" aria-hidden />
      {label}
      {activeCount > 0 && (
        <span className="grid size-5 place-items-center rounded-full bg-ink text-xs text-bg">{activeCount}</span>
      )}
    </button>
  );
}

interface PanelProps {
  title: string;
  closeLabel: string;
  showResultsLabel: string;
  children: ReactNode;
}

export function FilterDrawerPanel({ title, closeLabel, showResultsLabel, children }: PanelProps) {
  const { open, setOpen } = useDrawer();

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-label={title}
        className={cn(
          // Phone: an off-canvas sheet. Desktop: an ordinary sticky sidebar.
          "fixed inset-y-0 right-0 z-50 flex w-[min(22rem,92vw)] flex-col bg-surface shadow-card transition-transform duration-300",
          "md:sticky md:top-32 md:z-auto md:max-h-[calc(100vh-10rem)] md:w-auto md:translate-x-0 md:self-start md:bg-transparent md:shadow-none md:transition-none",
          open ? "translate-x-0" : "invisible translate-x-full md:visible",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4 md:hidden">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={closeLabel}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4 md:p-0 md:pr-1">{children}</div>
        <div className="border-t border-line p-4 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 w-full rounded-full bg-brand text-sm font-semibold text-on-brand"
          >
            {showResultsLabel}
          </button>
        </div>
      </aside>
    </>
  );
}
