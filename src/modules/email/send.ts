import { log } from "@/modules/logs/logger";

/**
 * Email through Resend's HTTP API (no SDK needed). Optional: without
 * RESEND_API_KEY and EMAIL_FROM nothing is sent and every caller carries on.
 *
 *   RESEND_API_KEY   "re_…", a sending key for our domain (docs/DEPLOY.md)
 *   EMAIL_FROM       "Findy <noreply@your-domain>"; the domain must be verified in Resend
 *   EMAIL_REPLY_TO   optional, an inbox that receives replies
 */
const env = (name: string) => process.env[name]?.trim() || null;

export const emailEnabled = (): boolean => env("RESEND_API_KEY") !== null && env("EMAIL_FROM") !== null;

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Sends one email. Never throws: returns whether Resend accepted it, and logs failures. */
export async function sendEmail(email: Email, context: { userId?: string; kind: string }): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("EMAIL_FROM"),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(env("EMAIL_REPLY_TO") ? { reply_to: env("EMAIL_REPLY_TO") } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
    await log.info("auth", "email.sent", `Sent the ${context.kind} email`, { userId: context.userId, kind: context.kind });
    return true;
  } catch (error) {
    await log.error("auth", "email.failed", `Could not send the ${context.kind} email`, { error, userId: context.userId, kind: context.kind });
    return false;
  }
}
