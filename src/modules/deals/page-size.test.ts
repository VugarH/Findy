import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { parseDealFilters, withRememberedPageSize } = await import("./filters");

describe("remembered page size", () => {
  it("fills in when the URL names none", () => {
    expect(parseDealFilters(withRememberedPageSize({}, "100")).size).toBe(100);
  });

  it("gives way to the URL", () => {
    expect(parseDealFilters(withRememberedPageSize({ size: "50" }, "100")).size).toBe(50);
  });

  it("ignores a cookie that is not a page size", () => {
    expect(parseDealFilters(withRememberedPageSize({}, "999")).size).toBe(20);
  });
});
