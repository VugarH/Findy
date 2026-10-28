import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_QUERY_LENGTH } from "@/modules/search/normalize";
import { SearchInput } from "./search-input";

interface Props {
  action: string;
  placeholder: string;
  buttonLabel: string;
  defaultValue?: string;
  size?: "md" | "lg";
  className?: string;
  /** Params sent along with the query (e.g. the open category). */
  hidden?: Record<string, string>;
  /** An empty search is allowed (it clears the search), for lists that filter as you search. */
  optional?: boolean;
  /** Suggestions while typing (brands, popular searches); for searches over the whole catalog. */
  suggest?: { suggestions: string; brand: string };
}

/** A plain GET form: works without JavaScript and keeps searches shareable. */
export function SearchBar({ action, placeholder, buttonLabel, defaultValue, size = "md", className, hidden, optional = false, suggest }: Props) {
  const large = size === "lg";
  const inputClass = cn(
    "w-full rounded-full border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
    large ? "h-14 pl-13 pr-32 text-base shadow-card" : "h-11 pl-11 pr-4 text-sm",
  );
  return (
    <form action={action} role="search" className={cn("relative flex w-full items-center", className)}>
      <Search
        aria-hidden
        className={cn("pointer-events-none absolute text-muted", large ? "left-5 size-5" : "left-4 size-4")}
      />
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {suggest ? (
        <SearchInput
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={!optional}
          maxLength={MAX_QUERY_LENGTH}
          className={inputClass}
          labels={suggest}
        />
      ) : (
        <input
          type="search"
          name="q"
          required={!optional}
          minLength={2}
          maxLength={MAX_QUERY_LENGTH}
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          className={inputClass}
        />
      )}
      {large && (
        <button
          type="submit"
          className="absolute right-2 h-10 rounded-full bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong"
        >
          {buttonLabel}
        </button>
      )}
    </form>
  );
}
