"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import {
  disconnectTelegramAction,
  startTelegramLinkAction,
  telegramStatusAction,
  type TelegramStatus,
} from "@/modules/telegram/actions";
import { Button, buttonClass } from "@/components/ui/button";

/** How often the page asks whether Start was pressed, and for how long (the link lives 30 minutes). */
const POLL_MS = 3_000;
const GIVE_UP_MS = 30 * 60_000;

type Step = { name: "idle" } | { name: "waiting"; url: string; since: number } | { name: "expired" } | { name: "failed" };

/**
 * Connects the account to our Telegram bot, so price drops also arrive as a
 * Telegram message: the person opens a one-time link, presses Start, and this
 * card notices by itself.
 */
export function TelegramConnect({ initial }: { initial: TelegramStatus }) {
  const { t } = useI18n();
  const tg = t.telegram;
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step.name !== "waiting") return;
    const timer = setInterval(async () => {
      if (Date.now() - step.since > GIVE_UP_MS) {
        setStep({ name: "expired" });
        return;
      }
      const next = await telegramStatusAction().catch(() => null);
      if (next?.linked) {
        setStatus(next);
        setStep({ name: "idle" });
        router.refresh();
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [step, router]);

  async function connect() {
    setBusy(true);
    try {
      const result = await startTelegramLinkAction();
      setStep("url" in result ? { name: "waiting", url: result.url, since: Date.now() } : { name: "failed" });
    } catch {
      setStep({ name: "failed" });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectTelegramAction();
      setStatus({ linked: false, username: null });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="telegram" className="scroll-mt-28 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="flex items-center gap-2 font-bold">
            <Send className="size-4 text-brand" aria-hidden />
            {tg.heading}
          </h2>
          <p className="mt-1 text-sm text-muted" role="status">
            {status.linked
              ? status.username
                ? fmt(tg.connected, { name: `@${status.username}` })
                : tg.connectedNoName
              : step.name === "waiting"
                ? tg.waiting
                : step.name === "expired"
                  ? tg.expired
                  : step.name === "failed"
                    ? tg.unavailable
                    : tg.text}
          </p>
        </div>
        {status.linked ? (
          <Button variant="secondary" onClick={disconnect} disabled={busy}>
            {tg.disconnect}
          </Button>
        ) : step.name === "waiting" ? (
          <a href={step.url} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "primary" })}>
            <ExternalLink className="size-4" aria-hidden />
            {tg.open}
          </a>
        ) : (
          <Button onClick={connect} disabled={busy}>
            {tg.connect}
          </Button>
        )}
      </div>
    </section>
  );
}
