"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { loginAction, registerAction, type AuthFormState } from "@/modules/auth/actions";
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
  const { t, locale } = useI18n();
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
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.auth.working : t.auth.submitSignIn}
      </Button>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { t, locale } = useI18n();
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
          label={t.auth.acceptTerms}
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
