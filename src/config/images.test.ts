import { describe, expect, it } from "vitest";
import { GALLERY_MAX, galleryImages, usableImage } from "./images";

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

describe("galleryImages", () => {
  it("puts the main photo first, drops repeats and unusable photos, and stops at the limit", () => {
    const others = ["https://a.test/2.jpg", "https://a.test/1.jpg", "https://img.witcdn.net/x.jpg", "not a url", "https://a.test/3.jpg", "https://a.test/4.jpg", "https://a.test/5.jpg"];
    expect(galleryImages("https://a.test/1.jpg", others)).toEqual(
      ["https://a.test/1.jpg", "https://a.test/2.jpg", "https://a.test/3.jpg", "https://a.test/4.jpg"].slice(0, GALLERY_MAX),
    );
  });

  it("works without a main photo", () => {
    expect(galleryImages(null, ["https://a.test/2.jpg"])).toEqual(["https://a.test/2.jpg"]);
    expect(galleryImages(null, [])).toEqual([]);
  });
});
