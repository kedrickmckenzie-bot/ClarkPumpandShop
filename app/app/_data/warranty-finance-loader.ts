import "server-only";

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
  const invoices = fixture.invoices.filter((invoice) => {
    if (invoice.organizationId !== organizationId) return false;
    const lineIds = fixture.invoiceLines.filter((line) => line.organizationId === organizationId && line.invoiceId === invoice.id).map((line) => line.id);
    const allocations = fixture.invoiceLineAllocations.filter((allocation) => allocation.organizationId === organizationId && lineIds.includes(allocation.invoiceLineId));
    return allocations.length > 0 && allocations.every((allocation) => allowedStore(allocation.storeId));
  });
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
