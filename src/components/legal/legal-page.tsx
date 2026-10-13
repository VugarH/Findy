import { siteConfig } from "@/config/site";
import { LOCALE_TAGS } from "@/i18n/config";
import { getLegalDictionary, LEGAL_UPDATED } from "@/i18n/dictionaries/legal";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { Container } from "@/components/ui/container";

/** The terms of use or the privacy policy, as readable sections. */
export async function LegalPage({ doc }: { doc: "terms" | "privacy" }) {
  const { locale } = await getI18n();
  const legal = getLegalDictionary(locale);
  const page = legal[doc];
  const site = (text: string) => fmt(text, { site: siteConfig.name });
  const updated = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${LEGAL_UPDATED}T00:00:00Z`),
  );

  return (
    <Container className="max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">{page.title}</h1>
      <p className="mt-1 text-sm text-muted">{fmt(legal.updated, { date: updated })}</p>
      <p className="mt-6 leading-7">{site(page.intro)}</p>
      {page.sections.map((section, index) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-lg font-bold">
            {index + 1}. {site(section.heading)}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-2.5 leading-7 text-ink/85">
              {site(paragraph)}
            </p>
          ))}
        </section>
      ))}
    </Container>
  );
}

export async function legalMetadata(doc: "terms" | "privacy") {
  const { locale } = await getI18n();
  const page = getLegalDictionary(locale)[doc];
  return { title: page.title, description: fmt(page.intro, { site: siteConfig.name }).slice(0, 160) };
}
