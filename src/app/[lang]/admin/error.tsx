"use client";

import { useI18n } from "@/i18n/client";
import { ErrorView } from "@/components/layout/error-view";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { href } = useI18n();
  return <ErrorView error={error} retry={retry} homeHref={href("/admin")} />;
}
