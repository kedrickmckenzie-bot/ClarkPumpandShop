import type { OpsRepository, OrganizationScope } from "./repository";

/** Why a store needs a manager's attention right now; every count comes from open source records. */
export interface StoreAttention {
  storeId: string;
  /** Unresolved reports that the store cannot operate, or is only partly operating. */
  stopped: number;
  limited: number;
  /** Open urgent or emergency jobs whose next step is past its deadline. */
  urgentLate: number;
  /** Compliance inspections past their due date and not passed. */
  complianceOverdue: number;
}

const OPEN = ["awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_parts", "waiting_on_vendor"];
const MAX_PAGES = 20;

/** Stores with a stopped/limited operating report, a late urgent job, or overdue compliance, most serious first. */
export async function storesNeedingAttention(repository: OpsRepository, scope: OrganizationScope, now: string): Promise<StoreAttention[]> {
  const byStore = new Map<string, StoreAttention>();
  const entry = (storeId: string) => {
    let row = byStore.get(storeId);
    if (!row) byStore.set(storeId, row = { storeId, stopped: 0, limited: 0, urgentLate: 0, complianceOverdue: 0 });
    return row;
  };
  const today = now.slice(0, 10);
  await Promise.all([
    (async () => {
      for (let page = 0; page < MAX_PAGES; page++) {
        const risks = await repository.listOperatingRisks(scope, { view: "unresolved", limit: 100, offset: page * 100 });
        for (const risk of risks.items) if (risk.state === "unable_to_operate") entry(risk.storeId).stopped++; else entry(risk.storeId).limited++;
        if ((page + 1) * 100 >= risks.totalCount) break;
      }
    })(),
    (async () => {
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const late = await repository.listWorkOrders(scope, { priorities: ["urgent", "emergency"], statuses: OPEN, dueBefore: now, limit: 100, cursor });
        for (const job of late.items) if (job.dueAt && job.dueAt < now) entry(job.storeId).urgentLate++;
        if (!late.nextCursor) break;
        cursor = late.nextCursor;
      }
    })(),
    (async () => {
      for (let page = 0; page < MAX_PAGES; page++) {
        const overdue = await repository.queryInspections(scope, { today, view: "overdue", limit: 100, offset: page * 100 });
        for (const inspection of overdue.items) entry(inspection.storeId).complianceOverdue++;
        if ((page + 1) * 100 >= overdue.totalCount) break;
      }
    })(),
  ]);
  return [...byStore.values()].sort((a, b) => b.stopped - a.stopped || b.limited - a.limited || b.urgentLate - a.urgentLate || b.complianceOverdue - a.complianceOverdue || a.storeId.localeCompare(b.storeId));
}

/** "Can't operate · 2 urgent jobs late · 1 compliance overdue" — the reasons in plain words. */
export function attentionReason(row: StoreAttention) {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return [
    row.stopped ? "Can't operate" : row.limited ? "Partly operating" : undefined,
    row.urgentLate ? n(row.urgentLate, "urgent job late", "urgent jobs late") : undefined,
    row.complianceOverdue ? `${n(row.complianceOverdue, "compliance item", "compliance items")} overdue` : undefined,
  ].filter(Boolean).join(" · ");
}
