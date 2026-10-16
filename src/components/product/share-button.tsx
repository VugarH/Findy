"use client";

import { Check, Link2, MessageCircle, Send, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";

/**
 * "Share" on a product page. Phones get their own share sheet (Telegram,
 * WhatsApp, Instagram…); elsewhere a small menu with Telegram, WhatsApp and
 * "Copy link". The link carries utm_source=share, so Admin → Analytics shows
 * how many visitors shares bring.
 */
export function ShareButton({ title }: { title: string }) {
  const { t } = useI18n();
  const s = t.product.share;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const link = () => `${window.location.origin}${window.location.pathname}?utm_source=share`;

  async function onShare() {
    // The phone's own sheet when there is one; cancelling it is not an error.
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title, url: link() }).catch(() => undefined);
      return;
    }
    setOpen((value) => !value);
  }

  async function copy() {
    await navigator.clipboard.writeText(link()).catch(() => undefined);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1200);
  }

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-2";
  const url = () => encodeURIComponent(link());

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={onShare}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
      >
        <Share2 className="size-4" aria-hidden />
        {s.button}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-13 z-20 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-card">
          <a role="menuitem" className={item} target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${url()}&text=${encodeURIComponent(title)}`}>
            <Send className="size-5 text-muted" aria-hidden />
            Telegram
          </a>
          <a role="menuitem" className={item} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${title} `)}${url()}`}>
            <MessageCircle className="size-5 text-muted" aria-hidden />
            WhatsApp
          </a>
          <button role="menuitem" type="button" onClick={copy} className={cn(item, copied && "text-brand-strong")}>
            {copied ? <Check className="size-5" aria-hidden /> : <Link2 className="size-5 text-muted" aria-hidden />}
            {copied ? s.copied : s.copy}
          </button>
        </div>
      )}
    </div>
  );
}
