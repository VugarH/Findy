import { SiteShell } from "@/components/layout/site-shell";

/** Every public page. The admin panel (../admin) has its own frame. */
export default function SiteLayout({ children }: LayoutProps<"/[lang]">) {
  return <SiteShell>{children}</SiteShell>;
}
