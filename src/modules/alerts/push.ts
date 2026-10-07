import { inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the notification is clicked. */
  url: string;
}

interface Target {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured: boolean | undefined;

/** Push is optional: without keys the site still records notifications, it just cannot push them. */
export function pushConfigured(): boolean {
  if (configured !== undefined) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  configured = Boolean(publicKey && privateKey && subject);
  if (configured) webpush.setVapidDetails(subject!, publicKey!, privateKey!);
  return configured;
}

/** Sends one message to several browsers. Subscriptions the browser has revoked are deleted. */
export async function sendPush(targets: Target[], message: PushMessage): Promise<number> {
  if (targets.length === 0 || !pushConfigured()) return 0;

  const payload = JSON.stringify(message);
  const gone: string[] = [];
  let delivered = 0;

  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          payload,
          { TTL: 86_400 },
        );
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404 / 410: the browser unsubscribed or the subscription expired.
        if (status === 404 || status === 410) gone.push(target.id);
        else console.error("Push failed", status ?? error);
      }
    }),
  );

  if (gone.length > 0) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  return delivered;
}
