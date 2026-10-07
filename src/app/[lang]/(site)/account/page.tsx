import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { logoutAction } from "@/modules/auth/actions";
import { getCurrentUser } from "@/modules/auth/session";
import { listUserOrderRequests } from "@/modules/orders/service";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.account, robots: { index: false } };
}

export default async function AccountPage() {
  const { t, href, locale, money } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect(`${href("/login")}?next=${encodeURIComponent(href("/account"))}`);

  const dateFormat = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { dateStyle: "long" });
  const since = dateFormat.format(user.createdAt);
  const requests = await listUserOrderRequests(user.id);
  const rows = [
    { label: t.auth.fullName, value: user.fullName },
    { label: t.auth.email, value: user.email, note: user.emailVerifiedAt ? undefined : t.auth.emailNotVerified },
    { label: t.auth.phone, value: user.phone ?? t.auth.noPhone },
  ];

  return (
    <Container className="max-w-2xl py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.auth.accountTitle}</h1>
      <p className="mt-1 text-sm text-muted">{fmt(t.auth.memberSince, { date: since })}</p>

      <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4">
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className="text-right text-sm font-semibold">
              {row.value}
              {row.note && <span className="block text-xs font-normal text-muted">{row.note}</span>}
            </dd>
          </div>
        ))}
        <div className="px-5 py-4 text-sm text-muted">{user.dealAlerts ? t.auth.dealAlertsOn : t.auth.dealAlertsOff}</div>
      </dl>

      <section className="mt-8">
        <h2 className="text-xl font-bold">{t.order.myRequests}</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t.order.noRequests}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {request.quantity} × {request.productTitle}
                  </p>
                  <p className="text-xs text-muted">
                    {request.reference} · {request.supplierName} · {dateFormat.format(request.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">
                    {money(request.estimatedLandedMinor + request.estimatedFeeMinor)}
                  </p>
                  <p className="text-xs font-semibold text-global">{t.order.status[request.status]}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={logoutAction} className="mt-8">
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="secondary">
          {t.auth.signOut}
        </Button>
      </form>
    </Container>
  );
}
