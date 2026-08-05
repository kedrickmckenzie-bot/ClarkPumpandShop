"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WorkOrderDetail } from "@/components/work-order-detail";
import type { WorkOrder } from "@/lib/domain/types";

export function CreatedWorkOrderDetail({ workOrderId }: { workOrderId: string }) {
  const [record, setRecord] = useState<WorkOrder | null | undefined>(undefined);
  const [context, setContext] = useState<Record<string, Record<string, string> | undefined>>({});
  useEffect(() => {
    const entities = ["work-orders", "stores", "cost-centers", "assets", "components"] as const;
    Promise.all(entities.map((entity) => fetch(`/api/registry?entity=${entity}`).then(async (response) => await response.json() as { ok: boolean; records: Array<Record<string, string | number>> })))
      .then((results) => {
        const item = results[0].ok ? results[0].records.find((candidate) => candidate.id === workOrderId) : undefined;
        if (!item) { setRecord(null); return; }
        const normalized = { ...item, reportIds: [], escalation: item.escalation ?? "Maintenance Supervisor", nteCents: item.nteCents ?? 0, costExposureCents: item.costExposureCents ?? 0, vendorAcceptance: item.vendorAcceptance ?? "not_issued", estimatedHours: Number(item.estimatedMinutes ?? 0) / 60, targetCompletionAt: item.dueAt } as unknown as WorkOrder;
        setRecord(normalized);
        const store = results[1].records.find((candidate) => candidate.id === item.storeId);
        const system = results[2].records.find((candidate) => candidate.id === item.systemId);
        const asset = results[3].records.find((candidate) => candidate.id === item.assetId);
        const component = results[4].records.find((candidate) => candidate.id === item.componentId);
        setContext({ store: store as Record<string, string> | undefined, system: system as Record<string, string> | undefined, asset: asset as Record<string, string> | undefined, component: component as Record<string, string> | undefined });
      }).catch(() => setRecord(null));
  }, [workOrderId]);
  if (record === undefined) return <AppShell><div className="page"><div className="empty-state">Loading work order…</div></div></AppShell>;
  if (!record) return <AppShell><div className="page"><div className="callout danger"><strong>Work order not found</strong><p>This record is not available in the current tenant.</p></div></div></AppShell>;
  return <WorkOrderDetail workOrder={record} context={{ store: context.store as { id: string; code: string; name: string; city: string } | undefined, system: context.system as { id: string; name: string } | undefined, asset: context.asset as { id: string; name: string } | undefined, component: context.component as { id: string; name: string } | undefined }} />;
}
