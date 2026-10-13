/**
 * Makes log details safe and small before they are stored (pure).
 * Secrets never reach the log, and one entry stays a few kilobytes at most.
 */

/** Keys whose values are never stored, at any depth. */
const SECRET_KEY = /pass(word)?|secret|token|cookie|authorization|auth|api[-_]?key|session|p256dh|endpoint|card|iban|cvv/i;
const MAX_STRING = 500;
const MAX_STACK = 3000;
const MAX_ITEMS = 20;
const MAX_DEPTH = 4;

export const REDACTED = "[redacted]";

/** An error as plain data: its kind, message, stack and cause. */
export function describeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) return { message: clip(String(error), MAX_STRING) };
  const described: Record<string, unknown> = {
    name: error.name,
    message: clip(error.message, MAX_STRING),
  };
  if (error.stack) described.stack = clip(error.stack, MAX_STACK);
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === "string") described.digest = digest;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") described.code = code;
  if (error.cause !== undefined && depth < 2) described.cause = describeError(error.cause, depth + 1);
  return described;
}

export function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  return clean(context, 0) as Record<string, unknown>;
}

function clean(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return clip(value, MAX_STRING);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return describeError(value);
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((item) => clean(item, depth + 1));
    return value.length > MAX_ITEMS ? [...items, `…${value.length - MAX_ITEMS} more`] : items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      out[key] = SECRET_KEY.test(key) ? REDACTED : clean(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
