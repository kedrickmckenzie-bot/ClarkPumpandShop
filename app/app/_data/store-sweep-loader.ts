import "server-only";

import { notFound } from "next/navigation";
import { roleCan } from "@/components/ops/role-policy";
import { heldWorkVendorEligibility } from "@/lib/ops/held-work-policy";
import { getServerOpsFixtureSnapshot, getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "./operator-loader";

export interface StoreSweepPlannerModel {
  asOf: string;
  planningBaseline: string;
  returnHref: string;
  selectedStoreId?: string;
  focusedWorkOrderId?: string;
  stores: Array<{ id: string; label: string; readyCount: number }>;
  selectedStore?: { id: string; label: string; timeZone: string; readyCount: number };
  vendorOptions: Array<{
    vendorId: string;
    vendorName: string;
    contractVersionId: string;
    serviceAreas: string[];
    jobs: Array<{
      workOrderId: string;
      number: string;
      problem: string;
      scope: string;
      serviceArea: string;
      posture: "Complete during the visit if practical" | "Inspect and report back";
      reviewLabel: string;
      reviewAt: string;
    }>;
  }>;
}

function approvedWorkReturnHref(value: string | undefined) {
  if (!value?.startsWith("/app/work-orders") || value.startsWith("//")) return "/app/work-orders?visitPlan=ready";
  try {
    const parsed = new URL(value, "https://operator.invalid");
    return parsed.origin === "https://operator.invalid" && parsed.pathname === "/app/work-orders"
      ? `${parsed.pathname}${parsed.search}`
      : "/app/work-orders?visitPlan=ready";
  } catch {
    return "/app/work-orders?visitPlan=ready";
  }
}

function dateOnly(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(value));
}

function reviewLabel(deadlineAt: string, asOf: string, timeZone: string) {
  const days = Math.ceil((Date.parse(deadlineAt) - Date.parse(asOf)) / 86_400_000);
  if (days < 0) return `Review overdue · ${dateOnly(deadlineAt, timeZone)}`;
  if (days === 0) return `Review today · ${dateOnly(deadlineAt, timeZone)}`;
  return `Review in ${days} ${days === 1 ? "day" : "days"} · ${dateOnly(deadlineAt, timeZone)}`;
}

export async function loadStoreSweepPlanner(requestedStoreId?: string, requestedWorkOrderId?: string, requestedReturnTo?: string): Promise<StoreSweepPlannerModel> {
  const [fixture, repository, session] = await Promise.all([
    getServerOpsFixtureSnapshot(),
    getServerOpsRepository(),
    loadOperatorSession(),
  ]);
  const planningBaseline = new Date(Math.max(Date.parse(fixture.asOf), Date.now())).toISOString();
  const returnHref = approvedWorkReturnHref(requestedReturnTo);
  if (!roleCan(session.role, "issue_work_order")) notFound();
  const visibleStores = fixture.stores.filter((store) => {
    if (store.organizationId !== session.organizationId) return false;
    if (session.storeIds?.length && !session.storeIds.includes(store.id)) return false;
    if (session.regionIds?.length && (!store.regionId || !session.regionIds.includes(store.regionId))) return false;
    return true;
  });
  const activeHolds = (fixture.workOrderVisitHolds ?? []).filter((hold) => hold.organizationId === session.organizationId && hold.status === "active");
  const readyWork = activeHolds.flatMap((hold) => {
    const workOrder = fixture.workOrders.find((row) => row.organizationId === session.organizationId && row.id === hold.workOrderId && row.status === "approved");
    return workOrder ? [{ hold, workOrder }] : [];
  });
  const requestedWork = requestedWorkOrderId
    ? readyWork.find(({ workOrder }) => workOrder.id === requestedWorkOrderId)?.workOrder
    : undefined;
  const stores = visibleStores.map((store) => ({
    id: store.id,
    label: `Store ${store.storeNumber} · ${store.name}`,
    readyCount: readyWork.filter(({ workOrder }) => workOrder.storeId === store.id).length,
  })).filter((store) => store.readyCount > 0).sort((left, right) => right.readyCount - left.readyCount || left.label.localeCompare(right.label));
  const selectedStoreId = requestedStoreId && stores.some((store) => store.id === requestedStoreId)
    ? requestedStoreId
    : requestedWork?.storeId ?? stores[0]?.id;
  const store = selectedStoreId ? visibleStores.find((row) => row.id === selectedStoreId) : undefined;
  if (requestedStoreId && !store) notFound();
  if (!store) return { asOf: fixture.asOf, planningBaseline, returnHref, stores, selectedStoreId: undefined, vendorOptions: [] };
  const storeTimeZone = store.timeZone ?? "America/New_York";

  const storeWork = readyWork.filter(({ workOrder }) => workOrder.storeId === store.id);
  const focusedWorkOrderId = requestedWork && requestedWork.storeId === store.id ? requestedWork.id : undefined;
  const vendorOptions = [] as StoreSweepPlannerModel["vendorOptions"];
  for (const vendor of fixture.vendors.filter((row) => row.organizationId === session.organizationId && row.status === "approved")) {
    const contract = fixture.contractVersions.find((row) => row.organizationId === session.organizationId
      && row.vendorId === vendor.id
      && row.status === "active"
      && row.reactiveWorkAllowed
      && row.effectiveStartsAt <= fixture.asOf
      && (!row.effectiveEndsAt || row.effectiveEndsAt >= fixture.asOf));
    if (!contract) continue;
    const jobs = [] as StoreSweepPlannerModel["vendorOptions"][number]["jobs"];
    for (const { hold, workOrder } of storeWork) {
      const eligibility = await heldWorkVendorEligibility({ repository, organizationId: session.organizationId, vendorId: vendor.id, workOrder, now: fixture.asOf });
      if (!eligibility.allowed) continue;
      jobs.push({
        workOrderId: workOrder.id,
        number: workOrder.number,
        problem: workOrder.problem,
        scope: workOrder.authorizedScope ?? "Review the reported need and record what was done.",
        serviceArea: fixture.vendorSpecialties.find((row) => row.vendorId === vendor.id && row.canonicalKey === workOrder.categoryKey)?.displayName ?? (workOrder.categoryKey ?? "Service area pending"),
        posture: hold.posture === "look_and_report" ? "Inspect and report back" : "Complete during the visit if practical",
        reviewLabel: reviewLabel(hold.deadlineAt, fixture.asOf, storeTimeZone),
        reviewAt: hold.deadlineAt,
      });
    }
    if (!jobs.length) continue;
    jobs.sort((left, right) => Number(right.workOrderId === focusedWorkOrderId) - Number(left.workOrderId === focusedWorkOrderId) || left.number.localeCompare(right.number));
    vendorOptions.push({
      vendorId: vendor.id,
      vendorName: vendor.name,
      contractVersionId: contract.id,
      serviceAreas: fixture.vendorSpecialties.filter((row) => row.vendorId === vendor.id).map((row) => row.displayName),
      jobs,
    });
  }
  vendorOptions.sort((left, right) => right.jobs.length - left.jobs.length || left.vendorName.localeCompare(right.vendorName));
  return {
    asOf: fixture.asOf,
    planningBaseline,
    returnHref,
    selectedStoreId: store.id,
    focusedWorkOrderId,
    stores,
    selectedStore: { id: store.id, label: `Store ${store.storeNumber} · ${store.name}`, timeZone: storeTimeZone, readyCount: storeWork.length },
    vendorOptions,
  };
}
