/**
 * Pure rules of the messages between people and us (client-safe).
 */

/** Longest message, in characters: room for several links and a description. */
export const MAX_MESSAGE_LENGTH = 4000;
/** Messages a person can send in an hour, across all their conversations. */
export const MAX_MESSAGES_PER_HOUR = 30;
const SUBJECT_LENGTH = 80;

/** A conversation's title: the product it is about, or the start of the first message without its links. */
export function subjectOf(body: string, productTitle?: string | null): string {
  if (productTitle) return shorten(productTitle);
  const text = body.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  if (text) return shorten(text);
  // Only links: name the shop of the first one.
  const host = /https?:\/\/(?:www\.)?([^/\s]+)/.exec(body)?.[1];
  return host ?? shorten(body.trim());
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= SUBJECT_LENGTH ? clean : `${clean.slice(0, SUBJECT_LENGTH - 1).trimEnd()}…`;
}

/** Newer than when the reader last looked (never looked = everything is new). */
export function isUnread(lastFromOtherSide: Date | null, readAt: Date | null): boolean {
  return lastFromOtherSide !== null && (readAt === null || lastFromOtherSide > readAt);
}

export type TextPart = { text: string } | { url: string };

/** Splits a message into text and web links, so links can be shown clickable (never as HTML). */
export function linkParts(body: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of body.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    // A link at the end of a sentence keeps its full stop outside.
    const url = match[0].replace(/[.,;:!?)\]]+$/, "");
    if (match.index > last) parts.push({ text: body.slice(last, match.index) });
    parts.push({ url });
    last = match.index + url.length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

/** Statuses as the person sees them (mirrors ConversationStatus in the schema). */
export type RequestStatus = "waiting" | "open" | "closed";

/**
 * The person writes again only once the team has answered (open). While it
 * waits for the first reply they cannot add more; a closed one stays closed.
 */
export function personCanWrite(status: RequestStatus): boolean {
  return status === "open";
}

/** A request's title: what it is about (the first attached item, "+2" for more), else the message's start. */
export function subjectOfRequest(body: string, items: { title: string }[]): string {
  if (items.length === 0) return subjectOf(body);
  const first = shorten(items[0].title);
  return items.length === 1 ? first : `${first} +${items.length - 1}`;
}
