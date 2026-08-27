import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceRunDetailWorkspace } from "@/components/ops/service-run-workspace";
import { loadServiceRunWorkspace } from "../../_data/service-run-loader";

export const metadata: Metadata = { title: "Combined vendor visit" };

export default async function StoreSweepDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vendorLink?: string; notice?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { fixture, selected } = await loadServiceRunWorkspace(id);
  if (selected?.schedulerVersion !== "store-sweep-v1") notFound();
  const vendorLink = query.vendorLink?.startsWith("/public/service-run/") ? query.vendorLink : undefined;
  return <ServiceRunDetailWorkspace fixture={fixture} run={selected} publicResponseHref={vendorLink} notice={query.notice} />;
}
