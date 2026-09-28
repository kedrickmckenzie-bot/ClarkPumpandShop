import { InvoiceUploadQueue } from "@/components/workspace/invoice-upload-queue";
import type { Metadata } from "next";
import { InvoiceQueueWorkspace } from "@/components/workspace/invoice-queue-workspace";
import { loadInvoiceQueue } from "../_data/invoice-queue-loader";
import { ListSurface } from "@/components/ops/views";
import { buildInvoiceEvidenceModel, hasInvoiceEvidenceFilters, invoiceEvidenceParameters } from "../_data/invoice-evidence-presenter";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "../_data/operator-loader";
import type { OperatorSearchParameters } from "../_data/operator-presenter";
import { roleCanAccessListRoute } from "@/components/ops/role-policy";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Invoices" };
export default async function InvoiceReferencesPage({ searchParams }: { searchParams: Promise<OperatorSearchParameters> }) {
  const query = await searchParams;
  const session = await loadOperatorSession();
  if (!roleCanAccessListRoute(session.role, "invoices")) notFound();
  if (hasInvoiceEvidenceFilters(query)) {
    const result = await (await getServerOpsRepository()).listInvoiceEvidence(session, invoiceEvidenceParameters(query));
    return <ListSurface model={buildInvoiceEvidenceModel(result, session, query)} surface="invoices" searchParams={query} />;
  }
  const uploadsPage = Number(query.uploadsPage);
  return <InvoiceQueueWorkspace {...await loadInvoiceQueue(query)} uploads={<InvoiceUploadQueue review={query.view === "review"} page={Number.isSafeInteger(uploadsPage) && uploadsPage > 0 && uploadsPage < 1000000 ? uploadsPage : 1}/>}/>;
}
