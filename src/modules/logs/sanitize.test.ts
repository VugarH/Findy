import { describe, expect, it } from "vitest";
import { describeError, REDACTED, sanitizeContext } from "./sanitize";

describe("log details", () => {
  it("never keeps secrets, at any depth", () => {
    const clean = sanitizeContext({ email: "a@b.c", password: "x", nested: { apiKey: "k", ok: 1 }, headers: { cookie: "s=1" } });
    expect(clean).toEqual({ email: "a@b.c", password: REDACTED, nested: { apiKey: REDACTED, ok: 1 }, headers: { cookie: REDACTED } });
  });

  it("keeps entries small", () => {
    const clean = sanitizeContext({ long: "x".repeat(2000), list: Array.from({ length: 30 }, (_, i) => i) });
    expect((clean.long as string).length).toBeLessThanOrEqual(501);
    expect(clean.list).toHaveLength(21);
  });

  it("turns errors into plain data, with their cause", () => {
    const error = new Error("outer", { cause: new TypeError("inner") });
    const described = describeError(error);
    expect(described).toMatchObject({ name: "Error", message: "outer", cause: { name: "TypeError", message: "inner" } });
    expect(typeof described.stack).toBe("string");
    expect(describeError("plain")).toEqual({ message: "plain" });
  });
});
