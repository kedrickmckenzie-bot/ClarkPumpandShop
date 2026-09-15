import type { Metadata } from "next";
import { InvoiceQueueWorkspace } from "@/components/workspace/invoice-queue-workspace";
import { loadInvoiceQueue } from "../_data/invoice-queue-loader";
import { ListSurface } from "@/components/ops/views";
import { buildInvoiceEvidenceModel, hasInvoiceEvidenceFilters } from "../_data/invoice-evidence-presenter";
import { getRequestOpsTrendsFixtureSnapshot } from "../_data/request-data";
import { loadOperatorSession } from "../_data/operator-loader";
import type { OperatorSearchParameters } from "../_data/operator-presenter";
import { roleCanAccessListRoute } from "@/components/ops/role-policy";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Invoice references" };
export default async function InvoiceReferencesPage({ searchParams }: { searchParams: Promise<OperatorSearchParameters> }) {
  const query = await searchParams;
  const session = await loadOperatorSession();
  if (!roleCanAccessListRoute(session.role, "invoices")) notFound();
  if (hasInvoiceEvidenceFilters(query)) {
    const fixture = await getRequestOpsTrendsFixtureSnapshot(session.organizationId);
    return <ListSurface model={buildInvoiceEvidenceModel(fixture, session, query)} surface="invoices" searchParams={query} />;
  }
  return <InvoiceQueueWorkspace {...await loadInvoiceQueue(query)} />;
}
