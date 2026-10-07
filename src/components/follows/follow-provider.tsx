"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";
import { toggleFollowAction } from "@/modules/follows/actions";
import { followId, type FollowKind } from "@/modules/follows/keys";

interface FollowContextValue {
  isFollowing: (kind: FollowKind, key: string) => boolean;
  toggle: (kind: FollowKind, key: string) => Promise<void>;
  /** Follow whose toggle is in flight, to disable its button. */
  pendingId: string | null;
}

const FollowContext = createContext<FollowContextValue | null>(null);

/**
 * What the signed-in person follows, so every Follow button on the page shows
 * the right state and flips at once. Rendered once, in the site shell.
 */
export function FollowProvider({ initialIds, children }: { initialIds: string[]; children: ReactNode }) {
  const { t, href } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [ids, setIds] = useState(() => new Set(initialIds));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Signing in or out re-renders the shell with a new list.
  const [seen, setSeen] = useState(initialIds);
  if (seen !== initialIds) {
    setSeen(initialIds);
    setIds(new Set(initialIds));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const toggle = useCallback(
    async (kind: FollowKind, key: string) => {
      const id = followId(kind, key);
      setPendingId(id);
      try {
        const result = await toggleFollowAction(kind, key);
        if ("error" in result) {
          if (result.error === "signIn") {
            router.push(`${href("/login")}?next=${encodeURIComponent(pathname)}`);
            return;
          }
          setMessage(t.follows.errors[result.error]);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setMessage(null), 5000);
          return;
        }
        setIds((current) => {
          const next = new Set(current);
          if (result.following) next.add(id);
          else next.delete(id);
          return next;
        });
      } finally {
        setPendingId(null);
      }
    },
    [href, pathname, router, t],
  );

  const value = useMemo(
    () => ({ isFollowing: (kind: FollowKind, key: string) => ids.has(followId(kind, key)), toggle, pendingId }),
    [ids, toggle, pendingId],
  );

  return (
    <FollowContext.Provider value={value}>
      {children}
      {message &&
        createPortal(
          <p
            role="status"
            className="fixed bottom-5 left-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-center text-sm font-medium text-bg shadow-card"
          >
            {message}
          </p>,
          document.body,
        )}
    </FollowContext.Provider>
  );
}

export function useFollows(): FollowContextValue {
  const value = useContext(FollowContext);
  if (!value) throw new Error("useFollows must be used inside <FollowProvider>");
  return value;
}
