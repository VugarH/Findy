import type { ReactNode } from "react";
import { listWatchedProductIds } from "@/modules/alerts/service";
import { getCurrentUser } from "@/modules/auth/session";
import { followId } from "@/modules/follows/keys";
import { listFollows } from "@/modules/follows/service";
import { WatchProvider } from "@/components/alerts/watch-provider";
import { FollowProvider } from "@/components/follows/follow-provider";
import { Footer } from "./footer";
import { Header } from "./header";

/** The public site's frame: header, footer and the watched products and follows every button reads. */
export async function SiteShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const [watchedIds, followed] = user ? await Promise.all([listWatchedProductIds(user.id), listFollows(user.id)]) : [[], []];
  return (
    <WatchProvider initialIds={watchedIds}>
      <FollowProvider initialIds={followed.map((follow) => followId(follow.kind, follow.key))}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </FollowProvider>
    </WatchProvider>
  );
}
