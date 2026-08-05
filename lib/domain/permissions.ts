import type { DemoData, DocumentRecord, Role, WorkOrder } from "@/lib/domain/types";

export interface PermissionContext {
  organizationId: string;
  role: Role;
  regionIds?: string[];
  storeIds?: string[];
  vendorId?: string;
}

export function canViewWorkOrder(data: DemoData, context: PermissionContext, workOrder: WorkOrder) {
  if (context.organizationId !== data.organization.id) return false;
  if (["executive", "facilities"].includes(context.role)) return true;
  const store = data.stores.find((candidate) => candidate.id === workOrder.storeId);
  if (context.role === "regional") return Boolean(store?.regionId && context.regionIds?.includes(store.regionId));
  if (["store_manager", "employee"].includes(context.role)) return Boolean(context.storeIds?.includes(workOrder.storeId));
  if (context.role === "vendor_office" || context.role === "technician") return context.vendorId === workOrder.vendorId;
  return false;
}

export function vendorVisibleDocument(document: DocumentRecord, workOrder: WorkOrder, vendorId: string) {
  if (workOrder.vendorId !== vendorId) return false;
  return document.visibility === "vendor_shared" && (!document.vendorId || document.vendorId === vendorId);
}

export function vendorProjection(data: DemoData, vendorId: string, workOrder: WorkOrder) {
  if (workOrder.vendorId !== vendorId) throw new Error("Vendor cannot access this work order");
  const documents = data.documents.filter((document) => document.workOrderId === workOrder.id && vendorVisibleDocument(document, workOrder, vendorId));
  const asset = workOrder.assetId ? data.assets.find((candidate) => candidate.id === workOrder.assetId) : undefined;
  return {
    number: workOrder.number,
    title: workOrder.title,
    description: workOrder.description,
    priority: workOrder.priority,
    requestedServiceAt: workOrder.requestedServiceAt,
    store: data.stores.find((candidate) => candidate.id === workOrder.storeId),
    asset: asset ? { name: asset.name, manufacturer: asset.manufacturer, model: asset.model, warrantyEndsAt: asset.warrantyEndsAt } : undefined,
    documents,
  };
}
