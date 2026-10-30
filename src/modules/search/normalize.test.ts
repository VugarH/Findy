import { describe, expect, it } from "vitest";
import { looksLikeASearch } from "./normalize";

describe("what counts as a search", () => {
  it("leaves out markup and web addresses", () => {
    expect(looksLikeASearch("<script>alert(1)</script>")).toBe(false);
    expect(looksLikeASearch("<img src=x onerror=alert(1)>")).toBe(false);
    expect(looksLikeASearch("https://spam.example")).toBe(false);
  });

  it("keeps ordinary searches", () => {
    expect(looksLikeASearch("iphone 16 pro")).toBe(true);
    expect(looksLikeASearch("qadın çantası")).toBe(true);
    expect(looksLikeASearch("h&m t-shirt 100%")).toBe(true);
  });
});
