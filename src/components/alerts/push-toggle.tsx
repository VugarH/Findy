"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/modules/alerts/actions";
import { Button } from "@/components/ui/button";

type Status = "checking" | "unsupported" | "blocked" | "off" | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** The push service wants the key as raw bytes, not base64url text. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Lets this browser receive price-drop notifications even when the site is closed. */
export function PushToggle() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function detect(): Promise<Status> {
      if (!PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return "unsupported";
      }
      if (Notification.permission === "denied") return "blocked";
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? "on" : "off";
    }
    detect()
      .catch(() => "unsupported" as const)
      .then((next) => !cancelled && setStatus(next));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(PUBLIC_KEY!),
      });
      const json = subscription.toJSON();
      const saved = await savePushSubscriptionAction({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      if (!saved.ok) await subscription.unsubscribe();
      setStatus(saved.ok ? "on" : "off");
    } catch (error) {
      console.error("Could not turn on notifications", error);
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscriptionAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="flex items-center gap-2 font-bold">
          <BellRing className="size-4 text-brand" aria-hidden />
          {t.alerts.pushHeading}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {status === "on" && t.alerts.pushOn}
          {status === "blocked" && t.alerts.pushBlocked}
          {status === "unsupported" && t.alerts.pushUnsupported}
          {(status === "off" || status === "checking") && t.alerts.pushText}
        </p>
      </div>
      {status === "off" && (
        <Button onClick={enable} disabled={busy}>
          {t.alerts.pushEnable}
        </Button>
      )}
      {status === "on" && (
        <Button variant="secondary" onClick={disable} disabled={busy}>
          {t.alerts.pushDisable}
        </Button>
      )}
    </section>
  );
}
