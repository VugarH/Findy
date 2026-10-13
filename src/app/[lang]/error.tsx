"use client";

import { ErrorView } from "@/components/layout/error-view";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
