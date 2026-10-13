import { db } from "@/db/client";
import { appLogs, type LogLevel } from "@/db/schema";
import { describeError, sanitizeContext } from "./sanitize";

/** Parts of the system a log entry can come from (the filter in Admin → Logs). */
export const LOG_AREAS = [
  "request",
  "auth",
  "messages",
  "orders",
  "telegram",
  "push",
  "search",
  "stores",
  "pipeline",
  "follows",
  "logs",
] as const;
export type LogArea = (typeof LOG_AREAS)[number];

export interface LogDetails {
  /** The person it was about. */
  userId?: string | null;
  /** The error, if any: stored with its stack. */
  error?: unknown;
  /** Anything else useful: ids, counts, paths. Secrets are removed automatically. */
  [key: string]: unknown;
}

/** At most this many entries per event per minute go to the database (a flood still shows in the console). */
const MAX_PER_MINUTE = 30;
const recent = new Map<string, { count: number; resetAt: number }>();

function allowed(key: string, now: number): boolean {
  const entry = recent.get(key);
  if (!entry || entry.resetAt <= now) {
    recent.set(key, { count: 1, resetAt: now + 60_000 });
    if (recent.size > 500) for (const [k, v] of recent) if (v.resetAt <= now) recent.delete(k);
    return true;
  }
  return ++entry.count <= MAX_PER_MINUTE;
}

const CONSOLE = { info: console.log, warn: console.warn, error: console.error } as const;

/**
 * Writes one entry: to the console (Vercel and GitHub keep those briefly) and
 * to the app_logs table (Admin → Logs). Never throws: logging must not break
 * what it describes.
 */
async function write(level: LogLevel, area: LogArea, event: string, message: string, details: LogDetails = {}): Promise<void> {
  const { userId, error, ...rest } = details;
  const context = sanitizeContext(error === undefined ? rest : { ...rest, error: describeError(error) });
  CONSOLE[level](`[${level}] ${area}/${event}: ${message}`, Object.keys(context).length ? context : "");

  if (!process.env.DATABASE_URL || !allowed(`${area}/${event}`, Date.now())) return;
  try {
    await db.insert(appLogs).values({ level, area, event, message: message.slice(0, 1000), userId: userId ?? null, context });
  } catch (failure) {
    console.error("Could not store a log entry", failure instanceof Error ? failure.message : failure);
  }
}

export const log = {
  /** Something notable that went right: a message sent, a run finished. */
  info: (area: LogArea, event: string, message: string, details?: LogDetails) => write("info", area, event, message, details),
  /** Something went wrong but was handled: a store did not answer, a Telegram message bounced. */
  warn: (area: LogArea, event: string, message: string, details?: LogDetails) => write("warn", area, event, message, details),
  /** Something failed that a person noticed or that needs fixing. */
  error: (area: LogArea, event: string, message: string, details?: LogDetails) => write("error", area, event, message, details),
};
