import { describe, expect, it } from "vitest";
import { parseStoreList } from "./jobs";

describe("store list for a job", () => {
  it("accepts ids separated by commas or spaces, once each", () => {
    expect(parseStoreList(" SuperStep, allbeauty  superstep ")).toBe("superstep,allbeauty");
    expect(parseStoreList("")).toBe("");
  });

  it("refuses anything that is not a store id", () => {
    expect(parseStoreList("superstep; rm -rf")).toBeNull();
    expect(parseStoreList("a/b")).toBeNull();
  });
});
