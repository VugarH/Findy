import { describe, expect, it } from "vitest";
import { isNetworkHiccup } from "./http";

const fetchError = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } });

describe("network hiccups", () => {
  it("retries failures that never reached the store", () => {
    expect(isNetworkHiccup(fetchError("ENOTFOUND"))).toBe(true);
    expect(isNetworkHiccup(fetchError("ECONNRESET"))).toBe(true);
  });

  it("does not retry anything else", () => {
    expect(isNetworkHiccup(new Error("HTTP 403 for https://a.com"))).toBe(false);
    expect(isNetworkHiccup(fetchError("CERT_HAS_EXPIRED"))).toBe(false);
    expect(isNetworkHiccup(undefined)).toBe(false);
  });
});
