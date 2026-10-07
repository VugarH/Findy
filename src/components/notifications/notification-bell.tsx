"use client";

import Link from "next/link";
import { Bell, Flame, Loader2, Send, Sparkles, TrendingDown } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { markNotificationsReadAction, notificationFeedAction, type NotificationFeed } from "@/modules/alerts/actions";
import type { DigestSummary } from "@/modules/digest/pick";

interface Props {
  signedIn: boolean;
  /** Unread notifications at page load. */
  unread: number;
  /** The day's top deals, announced to everyone. */
  digest: DigestSummary | null;
  channelUrl: string | null;
}

// Which digest this browser has seen. Only a convenience, so it lives in localStorage.
const SEEN_KEY = "serfeli:digest-seen";
const SEEN_EVENT = "serfeli:digest-seen";

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN_KEY, id);
    window.dispatchEvent(new Event(SEEN_EVENT));
  } catch {
    // Storage blocked (private window): the dot just stays.
  }
}

function subscribeSeen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SEEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SEEN_EVENT, onChange);
  };
}

/** "5 min ago", "yesterday", or a date for anything older than a week. */
function timeAgo(iso: string, now: number, locale: Locale): string {
  const seconds = (Date.parse(iso) - now) / 1000;
  const relative = new Intl.RelativeTimeFormat(LOCALE_TAGS[locale], { numeric: "auto" });
  if (seconds > -3_600) return relative.format(Math.min(0, Math.round(seconds / 60)), "minute");
  if (seconds > -86_400) return relative.format(Math.round(seconds / 3_600), "hour");
  if (seconds > -7 * 86_400) return relative.format(Math.round(seconds / 86_400), "day");
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "long" }).format(new Date(iso));
}

/**
 * The bell in the header. Opens a list of the person's latest notifications
 * (price drops), headed by the day's top deals, which everyone sees — signed
 * in or not. The list is fetched each time it opens, and opening it counts as
 * reading it.
 */
export function NotificationBell({ signedIn, unread: initialUnread, digest, channelUrl }: Props) {
  const { t, href, money, locale } = useI18n();
  const n = t.notifications;
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [feed, setFeed] = useState<{ data: NotificationFeed; loadedAt: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  // On the server and during hydration the digest counts as seen, so the dot can only appear, never flash away.
  const seenId = useSyncExternalStore(subscribeSeen, readSeen, () => digest?.id ?? null);
  const digestNew = digest !== null && seenId !== digest.id;
  const badge = unread + (digestNew ? 1 : 0);

  async function load() {
    setStatus("loading");
    try {
      const data = await notificationFeedAction();
      if (!data) {
        setStatus("idle");
        return;
      }
      setFeed({ data, loadedAt: Date.now() });
      setStatus("idle");
      if (data.items.some((item) => item.unread)) {
        setUnread(0);
        void markNotificationsReadAction();
      }
    } catch {
      setStatus("failed");
    }
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (digest) markSeen(digest.id);
    if (signedIn) void load();
  }

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const label = badge > 0 ? fmt(n.buttonUnread, { count: badge }) : n.button;
  const items = feed?.data.items ?? [];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        title={n.button}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className={cn(
          "relative grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-2 hover:text-ink",
          open ? "bg-surface-2 text-ink" : "text-muted",
        )}
      >
        <Bell className="size-[18px]" aria-hidden />
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-deal px-1 text-[11px] font-bold leading-[18px] text-on-deal">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={n.title}
          className="absolute right-0 top-full z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-card"
        >
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold">{n.title}</h2>

          <div className="max-h-[min(28rem,65vh)] overflow-y-auto">
            {digest && (
              <Link
                href={`${href("/top")}?day=${digest.day}`}
                onClick={close}
                className="flex items-start gap-3 border-b border-line bg-brand-soft/40 px-4 py-3 hover:bg-surface-2"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-deal-soft text-deal">
                  <Flame className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {digest.isToday
                      ? fmt(n.topTitle, { count: digest.count })
                      : fmt(t.top.titleOn, {
                          date: new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
                            day: "numeric",
                            month: "long",
                            timeZone: "UTC",
                          }).format(new Date(`${digest.day}T12:00:00Z`)),
                        })}
                  </span>
                  <span className="block text-xs text-muted">
                    {fmt(n.topLine, {
                      date: new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
                        weekday: "long",
                        timeZone: "UTC",
                      }).format(new Date(`${digest.day}T12:00:00Z`)),
                      pct: digest.maxPct,
                    })}
                  </span>
                </span>
                {digestNew && <span className="mt-2 size-2 shrink-0 rounded-full bg-deal" aria-hidden />}
              </Link>
            )}

            {!signedIn ? (
              <div className="px-4 py-5 text-sm">
                <p className="font-semibold">{n.signInTitle}</p>
                <p className="mt-1 text-muted">{n.signInText}</p>
                <Link
                  href={href("/login")}
                  onClick={close}
                  className="mt-3 inline-flex h-9 items-center rounded-full bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong"
                >
                  {t.auth.signIn}
                </Link>
              </div>
            ) : status === "loading" && !feed ? (
              <p className="flex items-center gap-2 px-4 py-5 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {n.loading}
              </p>
            ) : status === "failed" ? (
              <div className="px-4 py-5 text-sm">
                <p className="text-muted">{n.failed}</p>
                <button type="button" onClick={load} className="mt-2 font-semibold text-brand-strong hover:underline">
                  {n.retry}
                </button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">{n.empty}</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={href(`/product/${item.slug}`)}
                      onClick={close}
                      className={cn("flex items-start gap-3 px-4 py-3 hover:bg-surface-2", item.unread && "bg-surface-2/60")}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                          item.unread ? "bg-deal-soft text-deal" : "bg-surface-2 text-muted",
                        )}
                      >
                        {item.type === "new_deal" ? (
                          <Sparkles className="size-4" aria-hidden />
                        ) : (
                          <TrendingDown className="size-4" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        {item.type === "new_deal" && (
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {fmt(t.follows.newDeal, { follow: item.followLabel ?? "" })}
                          </span>
                        )}
                        <span className={cn("block truncate text-sm", item.unread ? "font-bold" : "font-medium")}>
                          {item.title}
                        </span>
                        <span className="block text-xs text-muted">
                          {fmt(item.type === "new_deal" ? t.follows.newDealLine : t.alerts.dropLine, {
                            pct: item.pct,
                            price: money(item.newPriceMinor),
                            old: money(item.oldPriceMinor),
                            store: item.store,
                          })}
                        </span>
                        <span className="block text-xs text-muted">
                          {timeAgo(item.createdAt, feed!.loadedAt, locale)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(signedIn || channelUrl) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-sm font-semibold">
              {signedIn && (
                <Link href={href("/alerts")} onClick={close} className="text-brand-strong hover:underline">
                  {n.allAlerts}
                </Link>
              )}
              {feed?.data.suggestTelegram && (
                <Link
                  href={`${href("/alerts")}#telegram`}
                  onClick={close}
                  className="inline-flex items-center gap-1.5 text-muted hover:text-ink"
                >
                  <Send className="size-3.5" aria-hidden />
                  {n.telegram}
                </Link>
              )}
              {channelUrl && !feed?.data.suggestTelegram && (
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-muted hover:text-ink"
                >
                  <Send className="size-3.5" aria-hidden />
                  {n.channel}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
