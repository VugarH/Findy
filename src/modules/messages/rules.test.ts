import { describe, expect, it } from "vitest";
import { isUnread, linkParts, personCanWrite, subjectOf, subjectOfRequest } from "./rules";

describe("message rules", () => {
  it("titles a conversation by its product, else its text, else the shop", () => {
    expect(subjectOf("hi", "adidas Samba OG")).toBe("adidas Samba OG");
    expect(subjectOf("Please buy https://www.zara.com/tr/x.html in size M")).toBe("Please buy in size M");
    expect(subjectOf("https://www.zara.com/tr/x.html")).toBe("zara.com");
    expect(subjectOf("a".repeat(200))).toHaveLength(80);
  });

  it("knows what is unread", () => {
    const earlier = new Date("2026-10-12T10:00:00Z");
    const later = new Date("2026-10-12T11:00:00Z");
    expect(isUnread(null, null)).toBe(false);
    expect(isUnread(later, null)).toBe(true);
    expect(isUnread(later, earlier)).toBe(true);
    expect(isUnread(earlier, later)).toBe(false);
  });

  it("finds links, leaving a full stop after one outside", () => {
    expect(linkParts("See https://a.com/x?y=1. Size 42")).toEqual([
      { text: "See " },
      { url: "https://a.com/x?y=1" },
      { text: ". Size 42" },
    ]);
    expect(linkParts("no links")).toEqual([{ text: "no links" }]);
  });
});

describe("requests", () => {
  it("lets the person write only once the team has answered, and never in a closed one", () => {
    expect(personCanWrite("waiting")).toBe(false);
    expect(personCanWrite("open")).toBe(true);
    expect(personCanWrite("closed")).toBe(false);
  });

  it("titles a request by its first item, counting the rest", () => {
    expect(subjectOfRequest("", [{ title: "Nike Pegasus 41" }])).toBe("Nike Pegasus 41");
    expect(subjectOfRequest("hi", [{ title: "Nike Pegasus 41" }, { title: "Socks" }, { title: "Cap" }])).toBe("Nike Pegasus 41 +2");
    expect(subjectOfRequest("Can you get this lamp?", [])).toBe("Can you get this lamp?");
  });
});
