import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db/client";
import { sessions, users, type User } from "@/db/schema";

const COOKIE = "session";
const LIFETIME_MS = 30 * 86_400_000;

/** What the rest of the app may know about the signed-in person. Never the password hash. */
export type CurrentUser = Pick<User, "id" | "email" | "fullName" | "phone" | "role" | "dealAlerts" | "emailVerifiedAt" | "createdAt">;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Signs a browser in: a random token goes into an httpOnly cookie, and only
 * its hash is stored, so a leaked database cannot be used to impersonate anyone.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME_MS);

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    userAgent: (await headers()).get("user-agent")?.slice(0, 300) ?? null,
    expiresAt,
  });
  // Opportunistic clean-up of this person's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(COOKIE);
}

/** The signed-in person, or null. Looked up once per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      dealAlerts: users.dealAlerts,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
});
