"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { toggleWatchAction } from "@/modules/alerts/actions";

interface WatchContextValue {
  isWatched: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
  /** Product whose toggle is in flight, to disable its button. */
  pendingId: string | null;
}

const WatchContext = createContext<WatchContextValue | null>(null);

/**
 * Holds which products the signed-in person watches, so every bell on the page
 * shows the right state and flips instantly. Rendered once, in the root layout.
 */
export function WatchProvider({ initialIds, children }: { initialIds: string[]; children: ReactNode }) {
  const { t, href } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [ids, setIds] = useState(() => new Set(initialIds));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Signing in or out re-renders the layout with a new list.
  const [seen, setSeen] = useState(initialIds);
  if (seen !== initialIds) {
    setSeen(initialIds);
    setIds(new Set(initialIds));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const toggle = useCallback(
    async (productId: string) => {
      setPendingId(productId);
      try {
        const result = await toggleWatchAction(productId);
        if ("error" in result) {
          if (result.error === "signIn") {
            router.push(`${href("/login")}?next=${encodeURIComponent(pathname)}`);
            return;
          }
          setMessage(t.alerts.errors[result.error]);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setMessage(null), 5000);
          return;
        }
        setIds((current) => {
          const next = new Set(current);
          if (result.watched) next.add(productId);
          else next.delete(productId);
          return next;
        });
        router.refresh();
      } finally {
        setPendingId(null);
      }
    },
    [href, pathname, router, t],
  );

  const value = useMemo(
    () => ({ isWatched: (productId: string) => ids.has(productId), toggle, pendingId }),
    [ids, toggle, pendingId],
  );

  return (
    <WatchContext.Provider value={value}>
      {children}
      {message && (
        <p
          role="status"
          className="fixed bottom-5 left-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-center text-sm font-medium text-bg shadow-card"
        >
          {message}
        </p>
      )}
    </WatchContext.Provider>
  );
}

export function useWatch(): WatchContextValue {
  const value = useContext(WatchContext);
  if (!value) throw new Error("useWatch must be used inside <WatchProvider>");
  return value;
}
