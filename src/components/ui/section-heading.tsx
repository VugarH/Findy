import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Props {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
}

export function SectionHeading({ title, hint, action }: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="flex items-center gap-1 text-sm font-semibold text-brand-strong hover:underline"
        >
          {action.label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
