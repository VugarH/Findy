import { MessageCircle } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { ButtonLink } from "@/components/ui/button";

/** Messages live in an account: shown instead of the form to someone who is not signed in. */
export async function SignInPrompt({ next }: { next: string }) {
  const { t, href } = await getI18n();
  const query = `?next=${encodeURIComponent(next)}`;
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
      <MessageCircle className="mx-auto size-9 text-brand" aria-hidden />
      <h1 className="mt-3 text-xl font-bold">{t.messages.signInTitle}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{t.messages.signInText}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <ButtonLink href={href("/login") + query}>{t.messages.signIn}</ButtonLink>
        <ButtonLink href={href("/register") + query} variant="secondary">
          {t.messages.register}
        </ButtonLink>
      </div>
    </div>
  );
}
