import type { Metadata } from "next";
import Link from "next/link";
import { OTHER_SUBCATEGORY } from "@/config/subcategories";
import { fmt } from "@/i18n/format";
import { getAdminI18n } from "@/modules/admin/i18n";
import { getCategoryTree } from "@/modules/admin/taxonomy";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Badge, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.categories };
}

export default async function AdminCategoriesPage() {
  const { a, t, href, num } = await getAdminI18n();
  const tree = await getCategoryTree();
  const c = a.categories;
  const productsHref = (category: string, sub?: string) =>
    href(`/admin/products?category=${category}${sub ? `&sub=${sub}` : ""}`);

  return (
    <>
      <PageHeader title={a.nav.categories} intro={c.intro} />
      <p className="mb-6 max-w-3xl rounded-xl bg-surface-2 px-4 py-3 text-xs text-muted">{c.codeNote}</p>

      <div className="space-y-6">
        {tree.map((branch) => (
          <Panel
            key={branch.slug}
            flush
            title={
              <Link href={productsHref(branch.slug)} className="flex items-center gap-2 hover:underline">
                <CategoryIcon category={branch.slug} className="size-4" />
                {t.categories[branch.slug].name}
                <span className="font-normal text-muted">· {num(branch.products)}</span>
              </Link>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>{c.columns.name}</Th>
                  <Th className="text-right">{c.columns.products}</Th>
                  <Th className="text-right">{c.columns.live}</Th>
                  <Th className="text-right">{c.columns.deals}</Th>
                  <Th className="text-right">{c.columns.byHand}</Th>
                </tr>
              </thead>
              <tbody>
                {branch.subcategories.map((sub) => {
                  const unsorted = sub.slug === OTHER_SUBCATEGORY;
                  return (
                    <tr key={sub.slug} className="hover:bg-surface-2/50">
                      <Td>
                        <Link href={productsHref(branch.slug, sub.slug)} className="font-medium hover:underline">
                          {t.subcategories[sub.slug]}
                        </Link>
                        {unsorted && sub.products > 0 && (
                          <>
                            {" "}
                            <Badge tone="info">{c.unsorted}</Badge>
                          </>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{num(sub.products)}</Td>
                      <Td className="text-right tabular-nums">{num(sub.live)}</Td>
                      <Td className="text-right tabular-nums">{num(sub.deals)}</Td>
                      <Td className="text-right tabular-nums text-muted">{sub.locked ? num(sub.locked) : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {branch.stray > 0 && (
              <p className="px-4 py-2 text-xs text-muted">{fmt(c.stray, { count: num(branch.stray) })}</p>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}
