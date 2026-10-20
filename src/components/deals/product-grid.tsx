import { cn } from "@/lib/cn";
import type { ProductCardData } from "@/modules/catalog/card";
import { ProductCard, type CardLabels, type CardNote } from "./product-card";

interface Props extends CardLabels {
  cards: ProductCardData[];
  /** Optional extra line per card, keyed by product slug. */
  notes?: Record<string, CardNote | null>;
  /** "compact" is for lists beside a sidebar: slightly smaller cards, 3–4 per row. */
  density?: "comfortable" | "compact";
}

export function ProductGrid({ cards, notes, density = "comfortable", ...labels }: Props) {
  return (
    <ul
      className={cn(
        "grid",
        density === "compact"
          ? "grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
          : "grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      )}
    >
      {cards.map((card) => (
        <li key={card.slug} className="flex">
          <div className="flex w-full [&>a]:w-full">
            <ProductCard card={card} note={notes?.[card.slug]} compact={density === "compact"} {...labels} />
          </div>
        </li>
      ))}
    </ul>
  );
}
