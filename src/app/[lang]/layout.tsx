import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getMarket } from "@/config/markets";
import { I18nProvider } from "@/i18n/client";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { parseTheme, THEME_COOKIE } from "@/components/layout/theme";
import "../globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext", "cyrillic"] });

// Prices change daily and searches are per-request, so pages render on demand.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    title: { default: `${siteConfig.name} — ${t.meta.title}`, template: `%s · ${siteConfig.name}` },
    description: t.meta.description,
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang={lang} data-theme={theme} className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider locale={lang} t={getDictionary(lang)} currency={getMarket().currency}>
          {/* The frame (header, footer) comes from (site)/layout.tsx or admin/layout.tsx. */}
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
