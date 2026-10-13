import { describe, expect, it } from "vitest";
import { deviceOf, isBot, sourceOf, visitorId } from "./visitor";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

describe("visitors", () => {
  it("tells bots from people", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot(CHROME)).toBe(false);
  });

  it("knows the device", () => {
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-X710) Safari")).toBe("tablet");
    expect(deviceOf(CHROME)).toBe("desktop");
  });

  it("gives one id per visitor per day, different the next day", () => {
    const today = visitorId("1.2.3.4", CHROME, "2026-10-12", "salt");
    expect(visitorId("1.2.3.4", CHROME, "2026-10-12", "salt")).toBe(today);
    expect(visitorId("1.2.3.4", CHROME, "2026-10-13", "salt")).not.toBe(today);
    expect(today).toMatch(/^[0-9a-f]{16}$/);
  });

  it("names where a visit came from", () => {
    expect(sourceOf("https://www.google.com/", null, "findy-az.vercel.app")).toBe("google");
    expect(sourceOf("https://t.me/findy_az", null, "findy-az.vercel.app")).toBe("telegram");
    expect(sourceOf("https://l.instagram.com/?u=x", null, "findy-az.vercel.app")).toBe("instagram");
    expect(sourceOf("https://someblog.az/post", null, "findy-az.vercel.app")).toBe("someblog.az");
    expect(sourceOf("", null, "findy-az.vercel.app")).toBe("direct");
    expect(sourceOf("https://findy-az.vercel.app/az/deals", null, "findy-az.vercel.app")).toBeNull();
    expect(sourceOf("https://www.google.com/", "Spring_Promo", "findy-az.vercel.app")).toBe("spring_promo");
  });
});
