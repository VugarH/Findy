"use client";

import { Search, Tag } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { SearchSuggestion } from "@/modules/search/terms";

interface Props {
  defaultValue?: string;
  placeholder: string;
  required: boolean;
  maxLength: number;
  className: string;
  labels: { suggestions: string; brand: string };
}

const SUGGEST_URL = "/api/search/suggest";
const DEBOUNCE_MS = 150;
/** Answers already fetched in this tab, by what was typed. */
const answers = new Map<string, SearchSuggestion[]>();

/**
 * The search box with suggestions while typing (brands and popular searches).
 * Choosing one fills the box and sends the form, so the search stays a plain
 * GET request; without JavaScript the box works as an ordinary input.
 */
export function SearchInput({ defaultValue, placeholder, required, maxLength, className, labels }: Props) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  // Bumped when an answer arrives, so the list re-reads `answers`.
  const [, setAnswered] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const text = typed.trim();
  const items = text.length < 2 ? [] : (answers.get(text) ?? []);

  useEffect(() => {
    if (text.length < 2 || answers.has(text)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${SUGGEST_URL}?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const { suggestions } = (await response.json()) as { suggestions: SearchSuggestion[] };
        answers.set(text, suggestions);
        setAnswered((count) => count + 1);
      } catch {
        // Suggestions are a convenience: a failed request just shows none.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  const shown = open && items.length > 0;

  function choose(suggestion: SearchSuggestion) {
    const box = input.current;
    if (!box) return;
    box.value = suggestion.label;
    setOpen(false);
    box.form?.requestSubmit();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!shown) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      // -1 is the box itself: moving past either end returns to what was typed.
      setActive((current) => {
        const next = current + step;
        return next < -1 ? items.length - 1 : next >= items.length ? -1 : next;
      });
    } else if (event.key === "Enter" && active >= 0 && active < items.length) {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="search"
        name="q"
        required={required}
        minLength={2}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 && active < items.length ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          setTyped(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Later than a click on a suggestion, which would otherwise close the list first.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className={className}
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          aria-label={labels.suggestions}
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface py-1 text-left shadow-card"
        >
          {items.map((item, index) => (
            <li
              key={`${item.kind}:${item.label}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-ink",
                index === active && "bg-surface-2",
              )}
            >
              {item.kind === "brand" ? (
                <Tag aria-hidden className="size-4 shrink-0 text-muted" />
              ) : (
                <Search aria-hidden className="size-4 shrink-0 text-muted" />
              )}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.kind === "brand" && <span className="text-xs text-muted">{labels.brand}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
