"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WorkOrderDetail } from "@/components/work-order-detail";
import type { WorkOrder } from "@/lib/domain/types";

export function CreatedWorkOrderDetail({ workOrderId }: { workOrderId: string }) {
  const [record, setRecord] = useState<WorkOrder | null | undefined>(undefined);
  useEffect(() => { fetch("/api/registry?entity=work-orders").then((response) => response.json()).then((raw) => { const result = raw as { ok: boolean; records: WorkOrder[] }; const item = result.ok ? result.records.find((candidate) => candidate.id === workOrderId) : null; setRecord(item ? { ...item, reportIds: [], escalation: item.escalation ?? "Maintenance Supervisor", nteCents: item.nteCents ?? 0, costExposureCents: item.costExposureCents ?? 0, vendorAcceptance: item.vendorAcceptance ?? "not_issued" } : null); }).catch(() => setRecord(null)); }, [workOrderId]);
  if (record === undefined) return <AppShell><div className="page"><div className="empty-state">Loading work order…</div></div></AppShell>;
  if (!record) return <AppShell><div className="page"><div className="callout danger"><strong>Work order not found</strong><p>This record is not available in the current tenant.</p></div></div></AppShell>;
  return <WorkOrderDetail workOrder={record} />;
}
