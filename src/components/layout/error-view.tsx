"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button, buttonClass } from "@/components/ui/button";

/**
 * Shown when a page fails. The server error is already in Admin → Logs; its
 * code (digest) is shown so a report from a visitor can be matched to it.
 */
export function ErrorView({ error, retry, homeHref }: { error: Error & { digest?: string }; retry: () => void; homeHref?: string }) {
  const { t, href } = useI18n();
  const e = t.errorPage;
  return (
    <div className="mx-auto grid max-w-md place-items-center px-4 py-24 text-center">
      <TriangleAlert className="size-10 text-deal" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">{e.title}</h1>
      <p className="mt-2 text-muted">{e.text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw className="size-4" aria-hidden />
          {e.retry}
        </Button>
        <Link href={homeHref ?? href("/")} className={buttonClass({ variant: "secondary" })}>
          {e.home}
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-muted">
          {e.code}: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </div>
  );
}
