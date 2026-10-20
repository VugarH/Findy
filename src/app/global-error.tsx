"use client";

/**
 * Last resort, when even the site's frame failed: it has no styles, language
 * or theme of its own, so it says the essentials in all three languages.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="az">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, padding: 16, textAlign: "center" }}>
        <main style={{ maxWidth: 420 }}>
          <title>Findy</title>
          <h1 style={{ fontSize: 22 }}>Nəsə alınmadı · Something went wrong · Что-то пошло не так</h1>
          <p style={{ color: "#666" }}>Yenidən cəhd edin. · Please try again. · Попробуйте ещё раз.</p>
          <p style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => retry()} style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: "#0b7a55", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              Yenidən · Retry · Ещё раз
            </button>
            {/* A full reload, not a client navigation: the site's frame itself is what failed. */}
            {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
            <button onClick={() => window.location.assign("/")} style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid #ccc", background: "transparent", color: "inherit", cursor: "pointer" }}>
              Ana səhifə · Home · Главная
            </button>
          </p>
          {error.digest && <p style={{ fontSize: 12, color: "#888" }}>{error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
