import { describe, expect, it } from "vitest";
import { freshDrop } from "./fresh-drop";

const RULE = { windowDays: 3, lookbackDays: 10, minDropPct: 5 };
const prices = (rows: [string, number][]) => rows.map(([date, priceMinor]) => ({ date, priceMinor }));

describe("freshDrop", () => {
  it("finds a drop against the price three days ago", () => {
    expect(freshDrop(prices([["2026-10-17", 100], ["2026-10-18", 100], ["2026-10-19", 100], ["2026-10-20", 80]]), RULE)).toEqual({
      fromMinor: 100,
      fromOn: "2026-10-19",
      dropPct: 20,
    });
  });

  it("compares with the highest price in the window, so a raise then a cut counts", () => {
    expect(freshDrop(prices([["2026-10-17", 100], ["2026-10-19", 150], ["2026-10-20", 120]]), RULE)).toEqual({
      fromMinor: 150,
      fromOn: "2026-10-19",
      dropPct: 20,
    });
  });

  it("uses the latest check before the window when a store was not read for days", () => {
    expect(freshDrop(prices([["2026-10-12", 90], ["2026-10-15", 100], ["2026-10-20", 80]]), RULE)).toEqual({
      fromMinor: 100,
      fromOn: "2026-10-15",
      dropPct: 20,
    });
  });

  it("ignores checks older than the lookback", () => {
    expect(freshDrop(prices([["2026-10-01", 100], ["2026-10-20", 80]]), RULE)).toBeNull();
  });

  it("does not count a price that has been low for weeks", () => {
    expect(freshDrop(prices([["2026-10-01", 100], ["2026-10-10", 80], ["2026-10-17", 80], ["2026-10-19", 80], ["2026-10-20", 80]]), RULE)).toBeNull();
  });

  it("needs a drop of at least the minimum", () => {
    expect(freshDrop(prices([["2026-10-18", 100], ["2026-10-19", 97], ["2026-10-20", 97]]), RULE)).toBeNull();
  });

  it("keeps a drop from two days ago while the price stays down", () => {
    expect(freshDrop(prices([["2026-10-17", 100], ["2026-10-18", 70], ["2026-10-19", 70], ["2026-10-20", 70]]), RULE)?.dropPct).toBe(30);
  });

  it("needs at least one earlier check", () => {
    expect(freshDrop(prices([["2026-10-20", 80]]), RULE)).toBeNull();
  });
});
