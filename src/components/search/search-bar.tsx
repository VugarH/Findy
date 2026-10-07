import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_QUERY_LENGTH } from "@/modules/search/normalize";

interface Props {
  action: string;
  placeholder: string;
  buttonLabel: string;
  defaultValue?: string;
  size?: "md" | "lg";
  className?: string;
}

/** A plain GET form: works without JavaScript and keeps searches shareable. */
export function SearchBar({ action, placeholder, buttonLabel, defaultValue, size = "md", className }: Props) {
  const large = size === "lg";
  return (
    <form action={action} role="search" className={cn("relative flex w-full items-center", className)}>
      <Search
        aria-hidden
        className={cn("pointer-events-none absolute text-muted", large ? "left-5 size-5" : "left-4 size-4")}
      />
      <input
        type="search"
        name="q"
        required
        minLength={2}
        maxLength={MAX_QUERY_LENGTH}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className={cn(
          "w-full rounded-full border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
          large ? "h-14 pl-13 pr-32 text-base shadow-card" : "h-11 pl-11 pr-4 text-sm",
        )}
      />
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
