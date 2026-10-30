import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/i18n/config";
import { contentSecurityPolicy } from "@/lib/security-headers";

const LOCALE_COOKIE = "locale";

function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && isLocale(saved)) return saved;

  const accepted = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase());
  return accepted.find(isLocale) ?? DEFAULT_LOCALE;
}

/** Next.js reads the nonce from the request's policy and puts it on its own scripts. */
function withSecurityPolicy(request: NextRequest): NextResponse {
  const policy = contentSecurityPolicy(btoa(crypto.randomUUID()), process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

/** Every page lives under /{locale}; requests without one are redirected. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  if (hasLocale) return withSecurityPolicy(request);

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|go|_next|.*\\..*).*)"],
};
