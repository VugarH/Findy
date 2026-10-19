import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { authTokens, sessions, users, type AuthTokenPurpose } from "@/db/schema";
import { siteConfig, siteUrl } from "@/config/site";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { fmt, localePath } from "@/i18n/format";
import { renderEmail } from "@/modules/email/layout";
import { emailEnabled, sendEmail } from "@/modules/email/send";
import { hashPassword } from "./password";

/**
 * The two emailed links: confirm the address, and reset the password. Each
 * link carries a random token (only its hash is stored), works once, and
 * expires; a person gets at most MAX_PER_HOUR of each kind per hour.
 */
const LIFETIME_MS: Record<AuthTokenPurpose, number> = { "verify-email": 24 * 3_600_000, "reset-password": 3_600_000 };
const MAX_PER_HOUR = 3;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Whether sign-up confirmation and password reset by email are available. */
export const emailLinksEnabled = emailEnabled;

async function createLink(userId: string, purpose: AuthTokenPurpose, now: Date): Promise<string | null> {
  const since = new Date(now.getTime() - 3_600_000).toISOString();
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), gt(authTokens.createdAt, sql`${since}::timestamptz`)));
  if (recent >= MAX_PER_HOUR) return null;
  const token = randomBytes(32).toString("base64url");
  await db.insert(authTokens).values({ userId, purpose, tokenHash: hash(token), expiresAt: new Date(now.getTime() + LIFETIME_MS[purpose]), createdAt: now });
  return token;
}

/** The user a link belongs to, marking it used; null when unknown, used or expired. */
async function redeemLink(token: string, purpose: AuthTokenPurpose, now: Date): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.tokenHash, hash(token)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, sql`${now.toISOString()}::timestamptz`),
      ),
    )
    .returning({ userId: authTokens.userId });
  return row?.userId ?? null;
}

type Recipient = { id: string; email: string; fullName: string; locale: string };

function linkEmail(user: Recipient, purpose: AuthTokenPurpose, token: string) {
  const locale: Locale = isLocale(user.locale) ? user.locale : DEFAULT_LOCALE;
  const e = getDictionary(locale).email;
  const path = purpose === "verify-email" ? "/verify-email" : "/reset-password";
  const url = `${siteUrl()}${localePath(locale, path)}?token=${token}`;
  const words = purpose === "verify-email" ? e.verify : e.reset;
  const name = user.fullName.trim().split(/\s+/)[0];
  const { html, text } = renderEmail({
    heading: words.heading,
    paragraphs: [fmt(e.greeting, { name }), fmt(words.text, { site: siteConfig.name })],
    button: { label: words.button, url },
    note: words.note,
    footer: fmt(e.footer, { site: siteConfig.name }),
  });
  return { to: user.email, subject: fmt(words.subject, { site: siteConfig.name }), html, text };
}

export type LinkResult = "sent" | "tooMany" | "unavailable";

/** After sign-up, or "Send it again" on the account page. */
export async function sendVerificationEmail(user: Recipient, now = new Date()): Promise<LinkResult> {
  if (!emailEnabled()) return "unavailable";
  const token = await createLink(user.id, "verify-email", now);
  if (!token) return "tooMany";
  return (await sendEmail(linkEmail(user, "verify-email", token), { userId: user.id, kind: "verify-email" })) ? "sent" : "unavailable";
}

/** "Send it again": the same email for a signed-in person, in their own language. */
export async function sendVerificationEmailTo(userId: string): Promise<LinkResult> {
  const [user] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, locale: users.locale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ? sendVerificationEmail(user) : "unavailable";
}

/**
 * "Forgot your password?". Says nothing about whether the address has an
 * account: an unknown address simply gets no email.
 */
export async function sendPasswordReset(email: string, now = new Date()): Promise<"done" | "unavailable"> {
  if (!emailEnabled()) return "unavailable";
  const [user] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, locale: users.locale })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return "done";
  const token = await createLink(user.id, "reset-password", now);
  if (token) await sendEmail(linkEmail(user, "reset-password", token), { userId: user.id, kind: "reset-password" });
  return "done";
}

/** The confirmation link: marks the address as confirmed. */
export async function verifyEmail(token: string, now = new Date()): Promise<boolean> {
  const userId = await redeemLink(token, "verify-email", now);
  if (!userId) return false;
  await db.update(users).set({ emailVerifiedAt: now }).where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)));
  return true;
}

/**
 * The reset link: sets the new password and signs the person out everywhere
 * (whoever knew the old one loses access). Opening the emailed link also
 * proves the address. Returns the user to sign in on this browser, or null.
 */
export async function resetPassword(token: string, password: string, now = new Date()): Promise<string | null> {
  const userId = await redeemLink(token, "reset-password", now);
  if (!userId) return null;
  await db.update(users).set({ passwordHash: await hashPassword(password), emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${now.toISOString()}::timestamptz)` }).where(eq(users.id, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return userId;
}
