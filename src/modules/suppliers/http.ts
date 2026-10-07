import { gunzipSync } from "node:zlib";

/**
 * Polite HTTP for store integrations: an honest User-Agent, one request at a
 * time with a delay between them, a timeout, and a hard cap on the number of
 * requests a run may make. We never work around blocks or challenges — a store
 * that says no is recorded as failed.
 */
const CONTACT = process.env.BOT_CONTACT?.trim();
export const BOT_USER_AGENT = `SerfeliBot/0.1 (price comparison${CONTACT ? `; ${CONTACT}` : ""})`;

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRY_AFTER_MS = 90_000;

/**
 * Spaces requests out. Share one Throttle between clients that hit the same
 * infrastructure (e.g. every Shopify store), because the platform limits us as
 * one visitor no matter which store we ask.
 */
export class Throttle {
  private queue: Promise<void> = Promise.resolve();
  private lastAt = 0;

  constructor(private readonly delayMs: number) {}

  /** Runs `task` after every earlier task has finished and the delay has passed. */
  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const wait = this.lastAt + this.delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        this.lastAt = Date.now();
      }
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Holds every queued request back, e.g. when the server asks us to slow down. */
  pause(ms: number) {
    this.lastAt = Math.max(this.lastAt, Date.now() + ms - this.delayMs);
  }
}

export interface HttpResult {
  status: number;
  text: string;
  headers: Headers;
}

export class PoliteClient {
  private requests = 0;
  private readonly throttle: Throttle;

  constructor(
    private readonly options: {
      delayMs: number;
      maxRequests: number;
      signal?: AbortSignal;
      throttle?: Throttle;
      /** Per-request time limit; raise it for stores whose sitemaps are generated slowly. */
      timeoutMs?: number;
      /** Extra request headers, e.g. a cookie choosing the store's own market and currency. */
      headers?: Record<string, string>;
    },
  ) {
    this.throttle = options.throttle ?? new Throttle(options.delayMs);
  }

  get budgetLeft() {
    return this.options.maxRequests - this.requests;
  }

  /** GET that returns the status instead of throwing, for callers that treat 404 as an answer. */
  async get(url: string): Promise<HttpResult> {
    if (this.budgetLeft <= 0) throw new Error(`Request budget of ${this.options.maxRequests} exhausted`);
    this.requests++;

    let result = await this.throttle.run(() => this.fetchOnce(url));
    if (result.status === 429) {
      // The server told us to slow down: wait as long as it asks, try once more, then give up.
      this.throttle.pause(result.retryAfterMs);
      result = await this.throttle.run(() => this.fetchOnce(url));
      if (result.status === 429) this.throttle.pause(result.retryAfterMs);
    }
    return result;
  }

  async getText(url: string): Promise<string> {
    const { status, text } = await this.get(url);
    if (status < 200 || status >= 300) throw new Error(`HTTP ${status} for ${url}`);
    return text;
  }

  private async fetchOnce(url: string): Promise<HttpResult & { retryAfterMs: number }> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: {
        "User-Agent": BOT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,application/json,text/plain;q=0.9,*/*;q=0.8",
        ...this.options.headers,
      },
      signal: this.options.signal ? AbortSignal.any([this.options.signal, timeout]) : timeout,
      redirect: "follow",
    });
    const retryAfter = Number(response.headers.get("retry-after"));
    return {
      status: response.status,
      text: decodeBody(new Uint8Array(await response.arrayBuffer())),
      headers: response.headers,
      retryAfterMs: Math.min(MAX_RETRY_AFTER_MS, retryAfter > 0 ? retryAfter * 1000 : 30_000),
    };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Response body as text. Sitemaps are often published as .xml.gz files, which
 * arrive still gzipped (the compression is the file itself, not the transfer),
 * so a body that starts with the gzip signature is unpacked first.
 */
function decodeBody(bytes: Uint8Array): string {
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  return new TextDecoder().decode(gzipped ? gunzipSync(bytes) : bytes);
}

/** Decodes the HTML entities that appear in attribute values and structured data. */
export function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
