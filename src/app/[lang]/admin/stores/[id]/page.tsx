import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { fmt } from "@/i18n/format";
import { setStoreActiveAction } from "@/modules/admin/actions/stores";
import { param } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import { getAdminStore } from "@/modules/admin/stores";
import { ActionButton } from "@/components/admin/action-button";
import { StoreStatusBadge } from "@/components/admin/status-badges";
import { CollectButton, StoreNotes } from "@/components/admin/store-controls";
import { StoreForm } from "@/components/admin/store-form";
import { Badge, EmptyState, Facts, NoticeBanner, PageHeader, Panel, Table, Td } from "@/components/admin/ui";

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/stores/[id]">): Promise<Metadata> {
  const { id } = await params;
  const store = await getAdminStore(id);
  return { title: store?.name };
}

export default async function AdminStorePage({ params, searchParams }: PageProps<"/[lang]/admin/stores/[id]">) {
  const { id } = await params;
  const notice = param(await searchParams, "notice");
  const { a, t, href, dateTime, num } = await getAdminI18n();
  const store = await getAdminStore(id);
  if (!store) notFound();

  const d = a.stores.detail;
  const access = store.definition?.access;
  const reliability = store.definition?.reliability;

  return (
    <>
      <PageHeader
        back={{ href: href("/admin/stores"), label: d.back }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {store.name}
            <StoreStatusBadge status={store.status} labels={a.stores.statuses} />
          </span>
        }
        intro={
          <a
            href={store.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
          >
            {store.websiteUrl}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
        actions={
          <>
            <Link
              href={href(`/admin/products?store=${store.id}&status=all`)}
              className="text-sm font-semibold text-brand-strong hover:underline"
            >
              {d.viewProducts}
            </Link>
            <ActionButton
              action={setStoreActiveAction}
              fields={{ id: store.id, active: String(!store.active) }}
              variant={store.active ? "secondary" : "primary"}
            >
              {store.active ? a.common.switchOff : a.common.switchOn}
            </ActionButton>
          </>
        }
      />
      {notice === "created" && (
        <div className="mb-4">
          <NoticeBanner>{a.notices.created}</NoticeBanner>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title={d.overview}>
            <Facts
              items={[
                {
                  label: d.offers,
                  value:
                    fmt(d.offersLine, { live: num(store.liveOffers), total: num(store.offers) }) +
                    (store.manualOffers ? ` · ${fmt(d.manualLine, { count: store.manualOffers })}` : ""),
                },
                { label: d.collected, value: store.lastSuccessAt ? dateTime(store.lastSuccessAt) : a.common.never },
                ...(store.status === "failing" && store.lastError
                  ? [
                      {
                        label: d.lastError,
                        value: (
                          <span className="text-deal">
                            {store.lastError} · {dateTime(store.lastErrorAt)}
                          </span>
                        ),
                      },
                    ]
                  : []),
                { label: d.country, value: store.originCountry },
                { label: d.market, value: store.scope === "local" ? d.local : d.global },
                { label: d.currency, value: store.currency },
                {
                  label: d.categories,
                  value: store.categories.map((slug) => t.categories[slug].name).join(", ") || "—",
                },
                ...(reliability
                  ? [
                      {
                        label: d.reliability,
                        value: `${a.stores.form.bases[reliability.basis]}${reliability.note ? ` — ${reliability.note}` : ""}`,
                      },
                    ]
                  : []),
                { label: d.shipsToMarket, value: store.definition?.shipsToMarket ? a.common.yes : a.common.no },
                { label: d.trust, value: store.definition?.trustScore ?? "—" },
              ]}
            />
          </Panel>

          {access && (
            <Panel title={d.howWeRead}>
              <p className="text-sm">
                <Badge tone="info">
                  {a.stores.connections[access.kind as keyof typeof a.stores.connections] ?? access.kind}
                </Badge>{" "}
                <span className="text-muted">{access.summary}</span>
              </p>
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
                {access.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{d.fields}</h3>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                {Object.entries(access.fields).map(([field, source]) => (
                  <div key={field} className="contents">
                    <dt className="font-mono text-xs leading-5 text-muted">{field}</dt>
                    <dd className="min-w-0 break-words">{source}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{d.limits}</h3>
              <p className="mt-1 text-sm">
                {fmt(d.limitsLine, {
                  requests: access.politeness.maxRequestsPerRun,
                  delay: access.politeness.delayMs / 1000,
                })}
              </p>
              <p className="mt-1 text-sm text-muted">
                {d.robots}: {access.robots.notes}
              </p>
              {access.assumptions && access.assumptions.length > 0 && (
                <>
                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{d.assumptions}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                    {access.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          )}

          <Panel title={d.runs} flush>
            {store.runs.length === 0 ? (
              <EmptyState>{d.noRuns}</EmptyState>
            ) : (
              <Table>
                <tbody>
                  {store.runs.map((run) => (
                    <tr key={run.runId}>
                      <Td className="whitespace-nowrap">{dateTime(run.startedAt)}</Td>
                      <Td>
                        {run.ok ? (
                          <Badge tone="good">{fmt(d.runOk, { count: num(run.offers) })}</Badge>
                        ) : (
                          <span className="text-deal">
                            <Badge tone="bad">{d.runFailed}</Badge> <span className="text-xs">{run.error}</span>
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <p className="text-sm text-muted">{store.active ? d.switchOffHint : d.switchOnHint}</p>
            {store.active && access && access.kind !== "manual-entry" && store.status !== "retired" && (
              <div className="mt-4 border-t border-line pt-4">
                <CollectButton storeId={store.id} />
              </div>
            )}
          </Panel>
          <Panel>
            <StoreNotes storeId={store.id} notes={store.notes} />
          </Panel>
          {store.source === "code" && <p className="px-1 text-xs text-muted">{d.codeStore}</p>}
        </div>
      </div>

      {store.customStore && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold">{a.stores.form.editTitle}</h2>
          <StoreForm store={store.customStore} />
        </section>
      )}
    </>
  );
}
