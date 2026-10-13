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
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              background: "white",
              color: "#0b7a55",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            %
          </div>
          <div style={{ fontSize: 72, fontWeight: 800 }}>{siteConfig.name}</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 56, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>{t.meta.title}</div>
        <div style={{ marginTop: 24, fontSize: 30, opacity: 0.85, lineHeight: 1.35, maxWidth: 1000 }}>{t.meta.description}</div>
      </div>
    ),
    size,
  );
}
