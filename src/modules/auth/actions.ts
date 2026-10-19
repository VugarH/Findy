"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getMarket } from "@/config/markets";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { localePath } from "@/i18n/format";
import { log } from "@/modules/logs/logger";
import { resetPassword, sendPasswordReset, sendVerificationEmail, sendVerificationEmailTo } from "./email-links";
import { clearFailures, isBlocked, recordFailure } from "./rate-limit";
import { authenticate, registerUser } from "./service";
import { createSession, destroySession, getCurrentUser } from "./session";
import { fieldErrors, forgotSchema, loginSchema, registerSchema, resetSchema, type AuthErrorKey } from "./validation";

export interface AuthFormState {
  /** Error per field, as dictionary keys under `auth.errors`. */
  errors?: Record<string, AuthErrorKey>;
  /** An error that is not about one field. */
  formError?: AuthErrorKey;
  /** What was typed, so the form is not wiped on an error. Never includes passwords. */
  values?: Record<string, string>;
  /** The request went through (e.g. "we've sent you a link"). */
  done?: boolean;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

function localeOf(form: FormData): Locale {
  const value = text(form, "locale");
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Where to go after signing in: back to the page that asked for it, otherwise
 * the home page. Only ever a path on this site.
 */
function safeNext(form: FormData, locale: Locale): string {
  const next = text(form, "next");
  return next.startsWith(`/${locale}/`) && !next.includes("//") && !next.includes("\\") ? next : localePath(locale, "/");
}

export async function registerAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = localeOf(form);
  const values = {
    fullName: text(form, "fullName"),
    email: text(form, "email"),
    phone: text(form, "phone"),
    dealAlerts: text(form, "dealAlerts"),
    acceptTerms: text(form, "acceptTerms"),
  };

  const parsed = registerSchema.safeParse({
    ...values,
    password: text(form, "password"),
    confirmPassword: text(form, "confirmPassword"),
    acceptTerms: form.get("acceptTerms") ?? undefined,
    dealAlerts: form.get("dealAlerts") ?? undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  let userId: string;
  try {
    const result = await registerUser(parsed.data, locale, getMarket().code);
    if (!result.ok) return { errors: { email: "emailTaken" }, values };
    userId = result.userId;
    await createSession(userId);
    await log.info("auth", "user.registered", "A new account was created", { userId });
    // The confirmation email goes out after the response, so signing up stays quick.
    const recipient = { id: userId, email: parsed.data.email, fullName: parsed.data.fullName, locale };
    after(() => sendVerificationEmail(recipient));
  } catch (error) {
    await log.error("auth", "register.failed", "Registration failed", { error });
    return { formError: "unexpected", values };
  }
  redirect(safeNext(form, locale));
}

export async function loginAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = localeOf(form);
  const values = { email: text(form, "email") };

  const parsed = loginSchema.safeParse({ email: values.email, password: text(form, "password") });
  // One message for every failure: never reveal whether the email has an account.
  if (!parsed.success) return { formError: "invalidCredentials", values };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const limitKey = `${ip}|${parsed.data.email}`;
  if (isBlocked(limitKey)) {
    await log.warn("auth", "signin.blocked", "Sign-in blocked after too many wrong passwords", { email: parsed.data.email, ip });
    return { formError: "tooManyAttempts", values };
  }

  try {
    const userId = await authenticate(parsed.data.email, parsed.data.password);
    if (!userId) {
      recordFailure(limitKey);
      await log.warn("auth", "signin.failed", "Wrong email or password", { email: parsed.data.email, ip });
      return { formError: "invalidCredentials", values };
    }
    clearFailures(limitKey);
    await createSession(userId);
  } catch (error) {
    await log.error("auth", "signin.error", "Sign-in failed", { error });
    return { formError: "unexpected", values };
  }
  redirect(safeNext(form, locale));
}

/** "Forgot your password?": the same answer whether or not the address has an account. */
export async function forgotPasswordAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: text(form, "email") };
  const parsed = forgotSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  try {
    if ((await sendPasswordReset(parsed.data.email)) === "unavailable") return { formError: "emailUnavailable", values };
  } catch (error) {
    await log.error("auth", "reset.request-failed", "A password reset could not be requested", { error });
    return { formError: "unexpected", values };
  }
  return { done: true };
}

/** The emailed reset link's form: sets the new password, then signs in on this browser only. */
export async function resetPasswordAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const locale = localeOf(form);
  const parsed = resetSchema.safeParse({
    token: text(form, "token"),
    password: text(form, "password"),
    confirmPassword: text(form, "confirmPassword"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  let userId: string | null;
  try {
    userId = await resetPassword(parsed.data.token, parsed.data.password);
    if (!userId) return { formError: "linkInvalid" };
    await createSession(userId);
    await log.info("auth", "password.reset", "A password was reset through the emailed link", { userId });
  } catch (error) {
    await log.error("auth", "reset.failed", "A password reset failed", { error });
    return { formError: "unexpected" };
  }
  redirect(localePath(locale, "/account"));
}

/** "Send the confirmation email again" on the account page. */
export async function resendVerificationAction(): Promise<AuthFormState> {
  const user = await getCurrentUser();
  if (!user || user.emailVerifiedAt) return {};
  const result = await sendVerificationEmailTo(user.id);
  if (result === "tooMany") return { formError: "tooManyEmails" };
  if (result === "unavailable") return { formError: "emailUnavailable" };
  return { done: true };
}

export async function logoutAction(form: FormData): Promise<void> {
  await destroySession();
  redirect(localePath(localeOf(form), "/"));
}
