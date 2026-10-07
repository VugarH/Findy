import Link from "next/link";
import { Tag } from "lucide-react";
import { siteConfig } from "@/config/site";

export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
      <span className="grid size-8 place-items-center rounded-xl bg-brand text-on-brand">
        <Tag className="size-4" aria-hidden strokeWidth={2.5} />
      </span>
      {siteConfig.name}
    </Link>
  );
}
