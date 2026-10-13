import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { dayRange } = await import("./report");

describe("analytics periods", () => {
  it("lists the days of a period, oldest first, across month ends", () => {
    expect(dayRange("2026-10-02", 3)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(dayRange("2026-10-12", 7)).toHaveLength(7);
  });
});
