"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { unreadMessagesAction } from "@/modules/messages/actions";

/** How often an open, visible page re-reads the badge. One small count query. */
const POLL_MS = 60_000;

interface Props {
  href: string;
  label: string;
  /** Unread when the header was rendered on the server. */
  initial: number;
  /** Signed out: nothing to count. */
  signedIn: boolean;
}

/**
 * The unread-messages count, kept current. Headers and menus live in layouts,
 * which Next.js does not re-render on moving between pages, so the count is
 * re-read here: on every page change, when the tab comes back into view, and
 * every minute while it is visible.
 */
export function useUnreadMessages(initial: number, signedIn = true): number {
  const pathname = usePathname();
  // A newer server render (e.g. after opening a thread) wins over an older reading.
  const [reading, setReading] = useState<{ base: number; value: number } | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const read = () => {
      if (document.visibilityState !== "visible") return;
      unreadMessagesAction()
        .then((value) => live && setReading({ base: initial, value }))
        .catch(() => {
          // Offline or signed out meanwhile: keep the last count.
        });
    };
    read();
    const timer = window.setInterval(read, POLL_MS);
    document.addEventListener("visibilitychange", read);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", read);
    };
  }, [signedIn, initial, pathname]);

  return reading && reading.base === initial ? reading.value : initial;
}

/** The header's messages icon with its unread badge. */
export function MessagesLink({ href, label, initial, signedIn }: Props) {
  const unread = useUnreadMessages(initial, signedIn);

  return (
    <Link
      href={href}
      title={label}
      aria-label={unread > 0 ? `${label} (${unread})` : label}
      className="relative grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <MessageCircle className="size-[18px]" aria-hidden />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-deal px-1 text-[11px] font-bold leading-[18px] text-on-deal">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
