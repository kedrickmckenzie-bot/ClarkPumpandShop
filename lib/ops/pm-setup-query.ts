import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest } from "./types";
import { dashboardPageBounds } from "./dashboard-query";
import { pmScheduleScope, pmScheduleState } from "./pm-schedule-query";
import { pmStoreAllowed } from "./pm-record-query";

export interface PmSetupQuery extends PageRequest {
  asOf: string; store?: string; region?: string; program?: string; asset?: string;
  kind: "programs" | "targets" | "plans";
  filter?: "all" | "gaps" | "changes";
}
export interface PmSetupRow {
  storeSchedule?: boolean;
  id: string; name: string; programId?: string; programName?: string;
  storeId?: string; storeNumber?: string; storeName?: string; assetId?: string; assetName?: string;
  hasAssetReference?: boolean; hasProgramReference?: boolean; reason?: string;
  cadence: number; window: number; anchor?: string; nextWindow?: string;
  storeLevel: boolean; matchedTypes: number; targets: number; covered: number; plans: number; gaps: number; changes: number;
  due: number; missed: number;
}
export interface PmSetupSummary { programs: number; targets: number; covered: number; gaps: number; plans: number; changes: number; }
export interface PmSetupPage { items: PmSetupRow[]; totalCount: number; summary: PmSetupSummary; nextOffset?: number; }
export function pmTypeKey(value: string) { return value.trim().toLowerCase().replace(/^equipment-template-/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
export function validatePmSetupQuery(query: PmSetupQuery) {
  if (!Number.isFinite(Date.parse(query.asOf)) || !["programs", "targets", "plans"].includes(query.kind) || query.filter && !["all", "gaps", "changes"].includes(query.filter)) throw new RangeError("Choose a valid PM setup view.");
}
export const emptyPmSetupRow = (id: string, name: string): PmSetupRow => ({ id, name, cadence: 0, window: 0, storeLevel: false, matchedTypes: 0, targets: 0, covered: 0, plans: 0, gaps: 0, changes: 0, due: 0, missed: 0 });
/** Fixture reference only. Persisted callers aggregate and page in the database. */
export function pmSetupFromFixture(fixture: OpsFixture, scope: OrganizationScope, query: PmSetupQuery): PmSetupPage {
  validatePmSetupQuery(query);
  const stores = fixture.stores.filter(s => pmStoreAllowed(pmScheduleScope(scope, query), s)), storeById = new Map(stores.map(s => [s.id, s]));
  const programs = fixture.maintenancePrograms.filter(p => p.organizationId === scope.organizationId && p.status === "active" && (!query.program || p.id === query.program) && stores.length > 0);
  const programById = new Map(fixture.maintenancePrograms.filter(p => p.organizationId === scope.organizationId && p.status === "active").map(p => [p.id, p]));
  const assets = fixture.assets.filter(a => a.organizationId === scope.organizationId && storeById.has(a.storeId) && a.status !== "retired"), assetById = new Map(assets.map(a => [a.id, a]));
  const templates = fixture.equipmentTemplates.filter(t => t.organizationId === scope.organizationId && t.active);
  const rawPlans = fixture.pmPlans.filter(p => p.organizationId === scope.organizationId && p.active && p.storeId && storeById.has(p.storeId) && (!query.program || p.programId === query.program));
  const planRows = rawPlans.map(p => {
    const s = storeById.get(p.storeId!)!, candidate = p.assetId ? assetById.get(p.assetId) : undefined, a = candidate?.storeId === s.id ? candidate : undefined;
    const g = p.programId ? programById.get(p.programId) : undefined;
    const changed = !g || p.cadenceDays !== g.frequencyDays || p.completionWindowDays !== g.dueWindowDays || Boolean(p.cadenceOverrideReason);
    return { ...emptyPmSetupRow(p.id, p.name), programId: g?.id, programName: g?.name, storeId: s.id, storeNumber: s.storeNumber, storeName: s.name, assetId: a?.id, assetName: a?.name,
      hasAssetReference: Boolean(p.assetId), hasProgramReference: Boolean(p.programId), reason: p.cadenceOverrideReason, cadence: p.cadenceDays, window: p.completionWindowDays, changes: Number(changed) };
  });
  const targets: PmSetupRow[] = [], programRows: PmSetupRow[] = [];
  for (const p of programs) {
    const keys = new Set(p.applicableAssetTypes.map(pmTypeKey));
    const matched = templates.filter(t => keys.has(pmTypeKey(t.id)) || keys.has(pmTypeKey(t.name)));
    const ids = new Set(matched.map(t => t.id)), categorySchedule = p.applicableAssetTypes.some(t => t.startsWith("store_category:")), storeLevel = p.applicableAssetTypes.length === 0 || categorySchedule;
    const candidates = storeLevel ? stores.filter(s => !categorySchedule || rawPlans.some(plan => plan.programId === p.id && plan.storeId === s.id)).map(s => ({ s, a: undefined })) : assets.filter(a => a.equipmentTemplateId && ids.has(a.equipmentTemplateId)).map(a => ({ s: storeById.get(a.storeId)!, a }));
    const ownPlans = rawPlans.filter(plan => plan.programId === p.id);
    const ownTargets = candidates.map(({s,a}) => {
      const covering = ownPlans.filter(plan => plan.storeId === s.id && (a ? plan.assetId === a.id : !plan.assetId));
      return { ...emptyPmSetupRow(`${p.id}:${a?.id ?? s.id}`, a?.name ?? "Store maintenance"), programId: p.id, programName: p.name, storeId: s.id, storeNumber: s.storeNumber, storeName: s.name, assetId: a?.id, assetName: a?.name,
        cadence: p.frequencyDays, window: p.dueWindowDays, storeLevel, targets: 1, plans: covering.length, covered: Number(covering.length > 0), gaps: Number(covering.length === 0) };
    });
    targets.push(...ownTargets);
    const occurrences = fixture.pmOccurrences.filter(o => o.organizationId === scope.organizationId && ownPlans.some(plan => plan.id === o.planId && plan.storeId === o.storeId));
    const future = occurrences.filter(o => pmScheduleState(o, query.asOf) === "scheduled").sort((a,b) => Date.parse(a.windowStartsAt)-Date.parse(b.windowStartsAt) || a.id.localeCompare(b.id));
    programRows.push({ ...emptyPmSetupRow(p.id,p.name), ...(categorySchedule ? { storeSchedule: true } : {}), programId:p.id, programName:p.name, cadence:p.frequencyDays, window:p.dueWindowDays, anchor:p.scheduleAnchorAt ? new Date(p.scheduleAnchorAt).toISOString() : undefined,
      nextWindow:future[0] ? new Date(future[0].windowStartsAt).toISOString() : undefined, storeLevel, matchedTypes:matched.length, targets:ownTargets.length, covered:ownTargets.filter(t=>t.covered).length,
      gaps:ownTargets.filter(t=>t.gaps).length, plans:ownPlans.length, changes:planRows.filter(plan=>plan.programId===p.id && plan.changes).length,
      due:occurrences.filter(o=>["due","overdue"].includes(pmScheduleState(o,query.asOf))).length, missed:occurrences.filter(o=>pmScheduleState(o,query.asOf)==="missed").length });
  }
  const summary = { programs:programRows.length, targets:targets.length, covered:targets.filter(t=>t.covered).length, gaps:targets.filter(t=>t.gaps).length, plans:planRows.length, changes:planRows.filter(p=>p.changes).length };
  const rows = (query.kind === "programs" ? programRows : query.kind === "targets" ? targets : planRows).filter(r=>query.kind !== "plans" || !query.asset || (query.asset === "store" ? !r.hasAssetReference : r.assetId === query.asset)).filter(r=>query.filter === "gaps" ? r.gaps>0 : query.filter === "changes" ? r.changes>0 : true);
  rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const {limit,offset}=dashboardPageBounds(query);
  return {items:rows.slice(offset,offset+limit),totalCount:rows.length,summary,nextOffset:offset+limit<rows.length?offset+limit:undefined};
}
