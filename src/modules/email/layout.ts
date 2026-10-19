/**
 * The one email design: a heading, a few paragraphs, one button and a small
 * footer, as HTML with inline styles (what email apps understand) and as plain
 * text. Pure, so the wording can be tested.
 */
export interface EmailContent {
  heading: string;
  paragraphs: string[];
  button: { label: string; url: string };
  /** Small print under the button, e.g. "The link works for one hour." */
  note: string;
  footer: string;
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:#1f2933">${escape(p)}</p>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<h1 style="margin:0 0 16px;font-size:22px;color:#0b7a55">${escape(content.heading)}</h1>
${paragraphs}
<p style="margin:24px 0"><a href="${escape(content.button.url)}" style="display:inline-block;background:#0b7a55;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${escape(content.button.label)}</a></p>
<p style="margin:0 0 6px;font-size:13px;color:#5f6b66">${escape(content.note)}</p>
<p style="margin:0;font-size:12px;color:#8a948f;word-break:break-all">${escape(content.button.url)}</p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#8a948f">${escape(content.footer)}</p>
</td></tr></table></body></html>`;
  const text = [content.heading, "", ...content.paragraphs, "", `${content.button.label}: ${content.button.url}`, "", content.note, "", content.footer].join("\n");
  return { html, text };
}
