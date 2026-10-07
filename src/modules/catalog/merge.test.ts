import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { followMergeChain } = await import("./merge");

describe("merged duplicates", () => {
  it("follows pointers to the product that stays", () => {
    const pointers = new Map([
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(followMergeChain("a", pointers)).toBe("c");
    expect(followMergeChain("c", pointers)).toBe("c");
    expect(followMergeChain("x", pointers)).toBe("x");
  });

  it("stops on a loop instead of hanging", () => {
    const pointers = new Map([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(["a", "b"]).toContain(followMergeChain("a", pointers));
  });
});
