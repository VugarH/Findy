import { linkParts } from "@/modules/messages/rules";
import { cn } from "@/lib/cn";

export interface ThreadItem {
  id: string;
  /** True for the side that is reading: shown on the right. */
  mine: boolean;
  /** Who wrote it, as this reader should see it ("You", "Admin", the customer's name). */
  author: string;
  /** Already formatted in the reader's language and time zone. */
  time: string;
  body: string;
}

/** A conversation as chat bubbles. Links in messages are clickable; nothing is rendered as HTML. */
export function MessageThread({ items }: { items: ThreadItem[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className={cn("flex flex-col", item.mine ? "items-end" : "items-start")}>
          <p className="mb-1 px-1 text-xs text-muted">
            <span className="font-semibold text-ink">{item.author}</span> · {item.time}
          </p>
          <div
            className={cn(
              "max-w-[min(36rem,90%)] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6",
              item.mine ? "rounded-tr-md bg-brand text-on-brand" : "rounded-tl-md border border-line bg-surface text-ink",
            )}
          >
            {linkParts(item.body).map((part, index) =>
              "url" in part ? (
                <a
                  key={index}
                  href={part.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="break-all font-medium underline underline-offset-2"
                >
                  {part.url}
                </a>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
