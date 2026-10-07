import type { CategorySlug } from "@/config/categories";
import { cn } from "@/lib/cn";
import { CATEGORY_TEXT, CategoryIcon } from "@/components/ui/category-icon";

interface Props {
  imageUrl: string | null;
  title: string;
  category: CategorySlug;
  className?: string;
}

/** Product photo, or a category-tinted placeholder when the supplier gave none. */
export function ProductImage({ imageUrl, title, category, className }: Props) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- supplier images come from arbitrary hosts
      <img src={imageUrl} alt={title} loading="lazy" className={cn("size-full object-contain", className)} />
    );
  }
  return (
    <div
      role="img"
      aria-label={title}
      className={cn("relative grid size-full place-items-center bg-surface-2", CATEGORY_TEXT[category], className)}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.14]"
        style={{ background: "radial-gradient(circle at 30% 25%, currentColor, transparent 65%)" }}
      />
      <CategoryIcon category={category} className="relative size-1/4 min-h-8 min-w-8 opacity-80" strokeWidth={1.25} />
    </div>
  );
}
