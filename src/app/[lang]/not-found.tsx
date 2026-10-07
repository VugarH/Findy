import { getI18n } from "@/i18n/server";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SiteShell } from "@/components/layout/site-shell";

/** Rendered in place of everything under [lang], so it brings the site's own frame. */
export default async function NotFound() {
  const { t, href } = await getI18n();
  return (
    <SiteShell>
      <Container className="grid place-items-center py-24 text-center">
        <p className="text-6xl font-extrabold tracking-tight text-line">404</p>
        <h1 className="mt-4 text-2xl font-bold">{t.notFound.title}</h1>
        <p className="mt-2 max-w-sm text-muted">{t.notFound.text}</p>
        <ButtonLink href={href("/deals")} className="mt-6">
          {t.notFound.back}
        </ButtonLink>
      </Container>
    </SiteShell>
  );
}
