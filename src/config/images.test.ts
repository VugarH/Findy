import { describe, expect, it } from "vitest";
import { usableImage } from "./images";

describe("usableImage", () => {
  it("drops photos from servers that refuse to be shown elsewhere, and missing ones", () => {
    expect(usableImage("https://fakir.witcdn.net/a-60-O.jpg")).toBeNull();
    expect(usableImage(null)).toBeNull();
    expect(usableImage("not a url")).toBeNull();
    expect(usableImage("https://cdn.shopify.com/a.jpg")).toBe("https://cdn.shopify.com/a.jpg");
  });

  it("drops WitCDN photos served from a store's own subdomain too", () => {
    expect(usableImage("https://witcdn.dermoeczanem.com/a.jpg")).toBeNull();
    expect(usableImage("https://cdn.example.com/witcdn.jpg")).toBe("https://cdn.example.com/witcdn.jpg");
  });
});
