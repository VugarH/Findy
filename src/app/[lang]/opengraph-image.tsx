import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/** The picture shown when a page of the site is shared (Telegram, WhatsApp, Instagram…), unless the page has its own. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = siteConfig.name;

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const t = getDictionary(isLocale(lang) ? lang : DEFAULT_LOCALE);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b7a55 0%, #064e37 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* The logo mark (components/layout/logo.tsx), white on the green background. */}
          <svg width="88" height="88" viewBox="0 0 80 80">
            <rect width="80" height="80" rx="22" fill="white" />
            <path d="M29 66 L29 30 C29 20 33 15 40 15" fill="none" stroke="#0b7a55" strokeWidth="9" strokeLinecap="round" />
            <path d="M16 42 L42 42 L49 35" fill="none" stroke="#0b7a55" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="57" cy="27" r="10" fill="white" stroke="#0b7a55" strokeWidth="5" />
            <path d="M53 27 L56 30 L61.5 23.5" fill="none" stroke="#0b7a55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 72, fontWeight: 800 }}>{siteConfig.name.toLowerCase()}</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 56, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>{t.meta.title}</div>
        <div style={{ marginTop: 24, fontSize: 30, opacity: 0.85, lineHeight: 1.35, maxWidth: 1000 }}>{t.meta.description}</div>
      </div>
    ),
    size,
  );
}
