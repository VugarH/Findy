import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { describeError } = await import("./pipeline");

describe("describeError", () => {
  it("adds the reason Node's fetch hides in the cause", () => {
    const error = new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });
    expect(describeError(error)).toBe("fetch failed (ENOTFOUND)");
  });

  it("keeps plain messages as they are", () => {
    expect(describeError(new Error("HTTP 403 for https://x/products.json"))).toBe("HTTP 403 for https://x/products.json");
    expect(describeError("boom")).toBe("boom");
  });
});
