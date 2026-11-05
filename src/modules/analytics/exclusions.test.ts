import { describe, expect, it } from "vitest";
import { hasNoAnalyticsCookie, MAX_IGNORED_USERS, toIgnoredUsers } from "./exclusions";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

describe("analytics exclusions", () => {
  it("keeps only valid user ids, once each, within the limit", () => {
    expect(toIgnoredUsers(null)).toEqual([]);
    expect(toIgnoredUsers([id(1), "x", 3, id(1).toUpperCase()])).toEqual([id(1)]);
    expect(toIgnoredUsers(Array.from({ length: 80 }, (_, i) => id(i)))).toHaveLength(MAX_IGNORED_USERS);
  });

  it("reads the browser's opt-out cookie", () => {
    expect(hasNoAnalyticsCookie("a=1; findy_no_analytics=1; b=2")).toBe(true);
    expect(hasNoAnalyticsCookie("findy_no_analytics=0")).toBe(false);
    expect(hasNoAnalyticsCookie(null)).toBe(false);
  });
});
