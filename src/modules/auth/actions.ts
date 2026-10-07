"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMarket } from "@/config/markets";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { localePath } from "@/i18n/format";
import { clearFailures, isBlocked, recordFailure } from "./rate-limit";
import { authenticate, registerUser } from "./service";
import { createSession, destroySession } from "./session";
import { fieldErrors, loginSchema, registerSchema, type AuthErrorKey } from "./validation";

export interface AuthFormState {
  /** Error per field, as dictionary keys under `auth.errors`. */
  errors?: Record<string, AuthErrorKey>;
  /** An error that is not about one field. */
  formError?: AuthErrorKey;
  /** What was typed, so the form is not wiped on an error. Never includes passwords. */
  values?: Record<string, string>;
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
  } catch (error) {
    console.error("Registration failed", error);
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
  if (isBlocked(limitKey)) return { formError: "tooManyAttempts", values };

  try {
    const userId = await authenticate(parsed.data.email, parsed.data.password);
    if (!userId) {
      recordFailure(limitKey);
      return { formError: "invalidCredentials", values };
    }
    clearFailures(limitKey);
    await createSession(userId);
  } catch (error) {
    console.error("Sign-in failed", error);
    return { formError: "unexpected", values };
  }
  redirect(safeNext(form, locale));
}

export async function logoutAction(form: FormData): Promise<void> {
  await destroySession();
  redirect(localePath(localeOf(form), "/"));
}
