import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./security-headers";

describe("content security policy", () => {
  it("runs only scripts with the nonce, and never inline ones", () => {
    const scripts = contentSecurityPolicy("abc").split("; ").find((rule) => rule.startsWith("script-src"));
    expect(scripts).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
  });

  it("allows eval only in development", () => {
    expect(contentSecurityPolicy("abc")).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy("abc", true)).toContain("unsafe-eval");
  });

  it("cannot be framed by another site", () => {
    expect(contentSecurityPolicy("abc")).toContain("frame-ancestors 'none'");
  });
});
