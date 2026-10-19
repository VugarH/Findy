"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
  type AuthFormState,
} from "@/modules/auth/actions";
import { PASSWORD_MIN } from "@/modules/auth/validation";
import { Button } from "@/components/ui/button";
import { CheckField, FormField } from "./form-field";

const INITIAL: AuthFormState = {};

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-deal-soft px-4 py-3 text-sm font-medium text-deal">
      {message}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { t, locale, href } = useI18n();
  const [state, action, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state.formError && t.auth.errors[state.formError]} />

      <FormField
        label={t.auth.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values?.email}
        required
      />
      <FormField
        label={t.auth.password}
        name="password"
        type="password"
        autoComplete="current-password"
        reveal={{ show: t.auth.showPassword, hide: t.auth.hidePassword }}
        required
      />
      <p className="-mt-1 text-right">
        <Link href={href("/forgot-password")} className="text-sm font-semibold text-brand-strong hover:underline">
          {t.auth.forgotLink}
        </Link>
      </p>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.auth.working : t.auth.submitSignIn}
      </Button>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { t, locale, href } = useI18n();
  const [state, action, pending] = useActionState(registerAction, INITIAL);
  const error = (field: string) => (state.errors?.[field] ? t.auth.errors[state.errors[field]] : undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state.formError && t.auth.errors[state.formError]} />

      <FormField
        label={t.auth.fullName}
        name="fullName"
        autoComplete="name"
        defaultValue={state.values?.fullName}
        error={error("fullName")}
        required
      />
      <FormField
        label={t.auth.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values?.email}
        error={error("email")}
        required
      />
      <FormField
        label={t.auth.phone}
        optionalLabel={t.auth.optional}
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="+994"
        hint={t.auth.phoneHint}
        defaultValue={state.values?.phone}
        error={error("phone")}
      />
      <FormField
        label={t.auth.password}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        hint={t.auth.passwordHint}
        error={error("password")}
        reveal={{ show: t.auth.showPassword, hide: t.auth.hidePassword }}
        required
      />
      <FormField
        label={t.auth.confirmPassword}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={error("confirmPassword")}
        reveal={{ show: t.auth.showPassword, hide: t.auth.hidePassword }}
        required
      />

      <div className="space-y-3 pt-1">
        <CheckField
          label={withLinks(t.auth.acceptTerms, {
            terms: { href: href("/terms"), text: t.auth.termsLink },
            privacy: { href: href("/privacy"), text: t.auth.privacyLink },
          })}
          name="acceptTerms"
          defaultChecked={state.values?.acceptTerms === "on"}
          error={error("acceptTerms")}
          required
        />
        <CheckField label={t.auth.dealAlerts} name="dealAlerts" defaultChecked={state.values?.dealAlerts === "on"} />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.auth.working : t.auth.submitRegister}
      </Button>
    </form>
  );
}

/** "I agree to the {terms} and the {privacy}." with the placeholders as links (new tab, so the form keeps what was typed). */
function withLinks(template: string, links: Record<string, { href: string; text: string }>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const link = links[part.slice(1, -1)];
    return link ? (
      <a key={index} href={link.href} target="_blank" rel="noopener" className="font-semibold text-brand-strong underline underline-offset-2">
        {link.text}
      </a>
    ) : (
      part
    );
  });
}

/** "Forgot your password?": asks for the email, then says a link is on its way (whether or not the account exists). */
export function ForgotPasswordForm() {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(forgotPasswordAction, INITIAL);
  if (state.done) {
    return (
      <p role="status" className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-strong">
        {t.auth.forgotSent}
      </p>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormError message={state.formError && t.auth.errors[state.formError]} />
      <FormField
        label={t.auth.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values?.email}
        error={state.errors?.email && t.auth.errors[state.errors.email]}
        required
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.auth.working : t.auth.forgotSubmit}
      </Button>
    </form>
  );
}

/** The emailed reset link's form: a new password, twice. */
export function ResetPasswordForm({ token }: { token: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(resetPasswordAction, INITIAL);
  const error = (field: string) => (state.errors?.[field] ? t.auth.errors[state.errors[field]] : undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <FormError message={state.formError && t.auth.errors[state.formError]} />
      <FormField
        label={t.auth.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t.auth.passwordHint}
        error={error("password")}
        reveal={{ show: t.auth.showPassword, hide: t.auth.hidePassword }}
        required
      />
      <FormField
        label={t.auth.confirmPassword}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={error("confirmPassword")}
        reveal={{ show: t.auth.showPassword, hide: t.auth.hidePassword }}
        required
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.auth.working : t.auth.resetSubmit}
      </Button>
    </form>
  );
}

/** On the account page while the address is not confirmed: sends the confirmation email again. */
export function ResendVerificationButton() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(resendVerificationAction, INITIAL);
  if (state.done) return <p className="text-xs font-medium text-brand-strong">{t.auth.verificationSent}</p>;
  return (
    <form action={action} className="space-y-1">
      <button type="submit" disabled={pending} className="text-xs font-semibold text-brand-strong hover:underline disabled:opacity-60">
        {t.auth.resendVerification}
      </button>
      {state.formError && <p className="text-xs font-medium text-deal">{t.auth.errors[state.formError]}</p>}
    </form>
  );
}
