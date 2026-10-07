import { describe, expect, it } from "vitest";
import { RobotsPolicy } from "./robots";

const policy = RobotsPolicy.parse(`
User-agent: Googlebot
Disallow: /only-google

User-agent: *
Disallow: /cart
Disallow: /*.json$
Allow: /products.json
Disallow: /search   # comment
`);

describe("RobotsPolicy", () => {
  it("applies the * group", () => {
    expect(policy.allows("/cart/add")).toBe(false);
    expect(policy.allows("/search?q=x")).toBe(false);
    expect(policy.allows("/only-google")).toBe(true);
    expect(policy.allows("/collections/all")).toBe(true);
  });

  it("lets the longest rule win, with wildcards and $ anchors", () => {
    expect(policy.allows("/meta.json")).toBe(false);
    expect(policy.allows("/products.json")).toBe(true);
    expect(policy.allows("/meta.json?x=1")).toBe(true);
  });

  it("allows everything without rules", () => {
    expect(RobotsPolicy.parse("").allows("/anything")).toBe(true);
  });
});
