import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

interface Props {
  title: string;
  subtitle: string;
  /** "New here? Create account" style line under the form. */
  footer: { text: string; linkLabel: string; href: string };
  children: ReactNode;
}

/** The centred card shared by the sign-in and sign-up pages. */
export function AuthCard({ title, subtitle, footer, children }: Props) {
  return (
    <Container className="grid place-items-center py-10 md:py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
          {footer.text}{" "}
          <Link href={footer.href} className="font-semibold text-brand-strong hover:underline">
            {footer.linkLabel}
          </Link>
        </p>
      </div>
    </Container>
  );
}
