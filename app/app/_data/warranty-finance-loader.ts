import "server-only";
import { scopedInvoiceRecords } from "@/lib/ops/dashboard-cohorts";

import { notFound } from "next/navigation";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { loadOperatorSession } from "./operator-loader";

export async function loadWarrantyFinanceWorkspace(input: { warrantyCaseId?: string; invoiceId?: string } = {}) {
  const session = await loadOperatorSession();
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  const organizationId = session.organizationId;
  const allowedStore = (storeId: string) => {
    const store = fixture.stores.find((row) => row.organizationId === organizationId && row.id === storeId);
    if (!store) return false;
    if (session.role === "store_manager" && !session.storeIds?.length || session.role === "regional" && !session.regionIds?.length) return false;
    if (session.storeIds !== undefined && !session.storeIds.includes(store.id)) return false;
    if (session.regionIds !== undefined && (!store.regionId || !session.regionIds.includes(store.regionId))) return false;
    return true;
  };
  const warrantyCases = fixture.warrantyCases.filter((item) => {
    if (item.organizationId !== organizationId) return false;
    const workOrder = fixture.workOrders.find((row) => row.organizationId === organizationId && row.id === item.workOrderId);
    return Boolean(workOrder && allowedStore(workOrder.storeId));
  });
  const invoices = scopedInvoiceRecords(fixture, organizationId, new Set(fixture.stores.filter((store) => allowedStore(store.id)).map((store) => store.id)));
  const selectedWarrantyCase = input.warrantyCaseId ? warrantyCases.find((item) => item.id === input.warrantyCaseId) : undefined;
  const selectedInvoice = input.invoiceId ? invoices.find((item) => item.id === input.invoiceId) : undefined;
  if (input.warrantyCaseId && !selectedWarrantyCase) notFound();
  if (input.invoiceId && !selectedInvoice) notFound();
  return {
    fixture,
    session,
    warrantyCases,
    invoices,
    selectedWarrantyCase,
    selectedInvoice,
    canManageWarranty: ["executive", "facilities", "regional"].includes(session.role),
    canDecideInvoice: ["executive", "finance"].includes(session.role),
  };
}
