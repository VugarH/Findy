import { describe, expect, it } from "vitest";
import { renderEmail } from "./layout";

describe("email layout", () => {
  const email = renderEmail({
    heading: "Confirm <your> email",
    paragraphs: ["Hi Ann,", "Press the button."],
    button: { label: "Confirm", url: "https://findy.az/az/verify-email?token=abc&x=1" },
    note: "The link works for 24 hours.",
    footer: "Findy",
  });

  it("escapes text and keeps the link", () => {
    expect(email.html).toContain("Confirm &lt;your&gt; email");
    expect(email.html).toContain('href="https://findy.az/az/verify-email?token=abc&amp;x=1"');
  });

  it("has a plain-text version with the link", () => {
    expect(email.text).toContain("Confirm: https://findy.az/az/verify-email?token=abc&x=1");
    expect(email.text).toContain("Hi Ann,");
  });
});
