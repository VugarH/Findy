import type { Instrumentation } from "next";

/** Errors Next.js uses for control flow (redirect, notFound), not failures. */
const isNavigation = (digest: string | undefined) => !!digest && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(digest);

/**
 * Every unhandled server error (a page, a Server Action, an API route) goes to
 * Admin → Logs, with the page it happened on. Request headers are not stored:
 * they carry the session cookie.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  if (isNavigation(digest)) return;
  const { log } = await import("@/modules/logs/logger");
  const message = error instanceof Error ? error.message : String(error);
  await log.error("request", `${context.routeType}.failed`, message, {
    error,
    path: request.path.split("?")[0],
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
};
