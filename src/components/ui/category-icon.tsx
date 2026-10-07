import { Baby, Blocks, CookingPot, Dumbbell, Footprints, Gem, Shirt, ShoppingBag, Smartphone, Sparkles, Watch, type LucideProps } from "lucide-react";
import { getCategory, type CategoryIcon as IconName, type CategorySlug } from "@/config/categories";

const ICONS: Record<IconName, React.ComponentType<LucideProps>> = {
  smartphone: Smartphone,
  shirt: Shirt,
  footprints: Footprints,
  "shopping-bag": ShoppingBag,
  watch: Watch,
  gem: Gem,
  "cooking-pot": CookingPot,
  baby: Baby,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  blocks: Blocks,
};

/** Text colour class per category, backed by the --cat-* tokens. */
export const CATEGORY_TEXT: Record<CategorySlug, string> = {
  electronics: "text-cat-electronics",
  fashion: "text-cat-fashion",
  shoes: "text-cat-shoes",
  bags: "text-cat-bags",
  watches: "text-cat-watches",
  jewelry: "text-cat-jewelry",
  home: "text-cat-home",
  baby: "text-cat-baby",
  sports: "text-cat-sports",
  beauty: "text-cat-beauty",
  toys: "text-cat-toys",
};

export function CategoryIcon({ category, ...props }: { category: CategorySlug } & LucideProps) {
  const Icon = ICONS[getCategory(category).icon];
  return <Icon aria-hidden {...props} />;
}
