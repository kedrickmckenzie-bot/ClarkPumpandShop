import Link from "next/link";
import type { Metadata } from "next";
import { InvoiceQueueWorkspace } from "@/components/ops/warranty-finance-workspace";
import { ReceiveInvoiceLink } from "@/components/ops/invoice-receive-workspace";
import { loadWarrantyFinanceWorkspace } from "../_data/warranty-finance-loader";
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
  if (hasInvoiceEvidenceFilters(query)) {
    const session = await loadOperatorSession();
    if (!roleCanAccessListRoute(session.role, "invoices")) notFound();
    const fixture = await getRequestOpsTrendsFixtureSnapshot(session.organizationId);
    return <ListSurface model={buildInvoiceEvidenceModel(fixture, session, query)} surface="invoices" searchParams={query} />;
  }
  const { fixture, invoices, session } = await loadWarrantyFinanceWorkspace();
  return <>{["executive", "facilities", "finance"].includes(session.role) ? <><ReceiveInvoiceLink /><p><Link href="/app/invoices/accounting">Review invoices from accounting</Link></p></> : null}<InvoiceQueueWorkspace fixture={fixture} invoices={invoices} /></>;
}
