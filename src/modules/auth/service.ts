import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { decoyHash, hashPassword, verifyPassword } from "./password";
import type { RegisterInput } from "./validation";

export type RegisterResult = { ok: true; userId: string } | { ok: false; reason: "emailTaken" };

export async function registerUser(input: RegisterInput, locale: Locale, marketCode: string): Promise<RegisterResult> {
  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      phone: input.phone,
      locale,
      marketCode,
      dealAlerts: input.dealAlerts,
      termsAcceptedAt: new Date(),
      lastLoginAt: new Date(),
    })
    // The unique index decides, so two simultaneous sign-ups cannot both succeed.
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  return created ? { ok: true, userId: created.id } : { ok: false, reason: "emailTaken" };
}

/** Returns the user id when the email and password match, otherwise null. */
export async function authenticate(email: string, password: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always do the hashing work, so an unknown email is not faster than a wrong password.
  const matches = await verifyPassword(password, user?.passwordHash ?? (await decoyHash()));
  if (!user || !matches) return null;

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return user.id;
}
