import { z } from "zod";

/**
 * Validation for the sign-up and sign-in forms. Messages are dictionary keys
 * (see `auth.errors` in src/i18n/dictionaries), so they are shown in the
 * visitor's language.
 */
export type AuthErrorKey =
  | "nameRequired"
  | "emailInvalid"
  | "passwordShort"
  | "passwordWeak"
  | "passwordLong"
  | "passwordMismatch"
  | "phoneInvalid"
  | "termsRequired"
  | "emailTaken"
  | "invalidCredentials"
  | "tooManyAttempts"
  | "unexpected";

export const PASSWORD_MIN = 8;
const key = (value: AuthErrorKey) => value;

/** Accepts "+994 50 123 45 67", "050-123-45-67", "0501234567"; returns "+994501234567". */
export function normalizePhone(input: string, defaultCountryCode = "994"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[\s().-]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  if (/^00\d{8,15}$/.test(digits)) return `+${digits.slice(2)}`;
  // A national number written with its leading zero.
  if (/^0\d{9}$/.test(digits)) return `+${defaultCountryCode}${digits.slice(1)}`;
  return "";
}

const email = z.string().trim().toLowerCase().pipe(z.email(key("emailInvalid")).max(254, key("emailInvalid")));

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, key("nameRequired")).max(100, key("nameRequired")),
    email,
    password: z
      .string()
      .min(PASSWORD_MIN, key("passwordShort"))
      .max(128, key("passwordLong"))
      .regex(/\p{L}/u, key("passwordWeak"))
      .regex(/\d/, key("passwordWeak")),
    confirmPassword: z.string(),
    // Optional: empty is fine, but if something is typed it must be a real number.
    phone: z
      .string()
      .transform((value) => normalizePhone(value))
      .refine((value) => value !== "", key("phoneInvalid")),
    acceptTerms: z.literal("on", key("termsRequired")),
    dealAlerts: z.string().optional().transform((value) => value === "on"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: key("passwordMismatch"),
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, key("invalidCredentials")).max(128, key("invalidCredentials")),
});

export type RegisterInput = z.output<typeof registerSchema>;

/** First error per field, as dictionary keys. */
export function fieldErrors(error: z.ZodError): Record<string, AuthErrorKey> {
  const result: Record<string, AuthErrorKey> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    result[field] ??= issue.message as AuthErrorKey;
  }
  return result;
}
