/**
 * What browsers may load on our pages. Applied per request by src/proxy.ts,
 * because the nonce is new each time: only scripts carrying it (Next.js adds
 * it to its own) run, so text injected into a page could not.
 */
export function contentSecurityPolicy(nonce: string, isDev = false): string {
  return [
    "default-src 'self'",
    // React's debug tools need eval, in development only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Style attributes are used across the UI; styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    // Product photos come from every store's own image host.
    "img-src 'self' https: http: data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws://localhost:*" : ""}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** The same on every response (next.config.ts). */
export const STATIC_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
