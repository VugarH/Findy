import { describe, expect, it, vi } from "vitest";
import type { CustomStore } from "./custom-config";

vi.mock("@/db/client", () => ({ db: {} }));

const { createCustomAdapter, customDefinition } = await import("./custom");

const store = (connection: CustomStore["config"]["connection"]): CustomStore => ({
  id: "nike-tr",
  name: "Nike Türkiye",
  websiteUrl: "https://www.nike.com.tr",
  originCountry: "TR",
  currency: "TRY",
  config: {
    reliability: { basis: "official-brand-store", note: "Nike's official store for Turkey" },
    shipsToMarket: false,
    categories: ["shoes", "fashion"],
    connection,
  },
});

describe("stores added in the admin panel", () => {
  it("uses the shared Shopify connector with the store's settings", () => {
    const adapter = createCustomAdapter(store({ type: "shopify" }));
    expect(adapter?.definition).toMatchObject({
      id: "nike-tr",
      scope: "global",
      categories: ["shoes", "fashion"],
      integration: "feed",
    });
    expect(adapter?.definition.access.entryPoints).toEqual(["https://www.nike.com.tr/products.json"]);
  });

  it("uses the shared sitemap connector, with patterns compiled from text", () => {
    const adapter = createCustomAdapter(
      store({
        type: "structured-data",
        sitemap: "https://www.nike.com.tr/sitemap.xml",
        productUrl: "-p-\\d+$",
        brandFromTitle: false,
        productsPerRun: 50,
      }),
    );
    expect(adapter?.definition.access.kind).toBe("sitemap-json-ld");
    expect(adapter?.definition.access.steps.join(" ")).toContain("/-p-\\d+$/");
    expect(adapter?.definition.access.politeness.maxRequestsPerRun).toBe(1 + 1 + 6 + 50);
  });

  it("has no connector for prices entered by hand, but still describes the store", () => {
    const manual = store({ type: "manual" });
    expect(createCustomAdapter(manual)).toBeNull();
    expect(customDefinition({ ...manual, originCountry: "AZ" })).toMatchObject({
      scope: "local",
      integration: "manual",
      access: { kind: "manual-entry" },
    });
  });
});
