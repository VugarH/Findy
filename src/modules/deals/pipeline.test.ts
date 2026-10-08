import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { describeError, planLanes } = await import("./pipeline");
import type { SupplierAdapter } from "@/modules/suppliers/types";

describe("describeError", () => {
  it("adds the reason Node's fetch hides in the cause", () => {
    const error = new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });
    expect(describeError(error)).toBe("fetch failed (ENOTFOUND)");
  });

  it("keeps plain messages as they are", () => {
    expect(describeError(new Error("HTTP 403 for https://x/products.json"))).toBe("HTTP 403 for https://x/products.json");
    expect(describeError("boom")).toBe("boom");
  });
});

describe("planLanes", () => {
  const adapter = (id: string, kind: string, maxRequestsPerRun: number) =>
    ({ definition: { id, access: { kind, politeness: { delayMs: 1500, maxRequestsPerRun } } } }) as unknown as SupplierAdapter;

  it("puts Shopify stores in their own lane and starts the biggest other stores first", () => {
    const adapters = [
      adapter("baku", "embedded-json", 40),
      adapter("nike", "shopify-json", 3),
      adapter("pastel", "sitemap-json-ld", 908),
      adapter("adidas", "shopify-json", 3),
      adapter("sinoz", "sitemap-json-ld", 308),
      adapter("gratis", "sitemap-json-ld", 908),
    ];
    const lanes = planLanes(adapters);
    expect(lanes.map((lane) => lane.name)).toEqual(["shopify", "own-pace"]);
    expect(lanes[0].order.map((i) => adapters[i].definition.id)).toEqual(["nike", "adidas"]);
    expect(lanes[1].order.map((i) => adapters[i].definition.id)).toEqual(["pastel", "gratis", "sinoz", "baku"]);
  });

  it("leaves out an empty lane", () => {
    expect(planLanes([adapter("nike", "shopify-json", 3)]).map((lane) => lane.name)).toEqual(["shopify"]);
  });
});
