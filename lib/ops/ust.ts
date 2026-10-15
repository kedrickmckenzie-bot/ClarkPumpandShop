import type { OpsCommandServices } from "./commands";
import { OpsDomainError } from "./errors";
import type { OpsStatement } from "./repository";
import type { ActorContext, OpsFixture } from "./types";
import { COMPLIANCE_TEMPLATES } from "./compliance-templates";

/**
 * Fuel tank (UST) operators. Each store with underground tanks designates trained Class A, B and C operators
 * (EPA 40 CFR 280 subpart J). The app keeps who they are and when their training expires; it never certifies anyone.
 */
export type UstOperatorClass = "A" | "B" | "C";
export const UST_CLASS_LABELS: Record<UstOperatorClass, string> = {
  A: "Class A · runs the tank program",
  B: "Class B · day-to-day tank upkeep",
  C: "Class C · responds to alarms and spills",
};

export interface UstOperator {
  id: string;
  organizationId: string;
  storeId: string;
  operatorClass: UstOperatorClass;
  name: string;
  certificateNumber?: string;
  trainedOn?: string;
  expiresOn?: string;
  recordedByName: string;
  createdAt: string;
  removedAt?: string;
  removedByName?: string;
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}

function audit(organizationId: string, operator: UstOperator, eventType: string, actor: ActorContext, now: string): OpsStatement {
  return insert("ops_audit_events", { id: `audit-${crypto.randomUUID()}`, organization_id: organizationId, aggregate_type: "store", aggregate_id: operator.storeId, event_type: eventType, actor_type: actor.actorType, actor_id: actor.actorId, actor_name: actor.actorName, occurred_at: now, payload_json: JSON.stringify({ operatorId: operator.id, operatorClass: operator.operatorClass, name: operator.name, certificateNumber: operator.certificateNumber, expiresOn: operator.expiresOn }) });
}

const date = (value: string | undefined, label: string) => {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || !Number.isFinite(Date.parse(value))) throw new OpsDomainError("VALIDATION", `Enter a valid ${label}.`);
  return value;
};

export async function addUstOperator(svc: OpsCommandServices, input: { organizationId: string; storeId: string; operatorClass: string; name: string; certificateNumber?: string; trainedOn?: string; expiresOn?: string; actor: ActorContext; key: string }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "This store is outside your organization.");
  if (!["A", "B", "C"].includes(input.operatorClass)) throw new OpsDomainError("VALIDATION", "Choose Class A, B or C.");
  const name = input.name.trim();
  if (!name || name.length > 120) throw new OpsDomainError("VALIDATION", "Enter the operator's name (120 characters or less).");
  if ((input.certificateNumber ?? "").length > 60) throw new OpsDomainError("VALIDATION", "Keep the certificate number under 60 characters.");
  if (!/^[A-Za-z0-9-]{8,80}$/u.test(input.key)) throw new OpsDomainError("VALIDATION", "Refresh the page and try again.");
  const trainedOn = date(input.trainedOn, "training date"), expiresOn = date(input.expiresOn, "expiration date");
  if (trainedOn && expiresOn && expiresOn < trainedOn) throw new OpsDomainError("VALIDATION", "The expiration date is before the training date.");
  if (!await svc.repository.getStore(input.organizationId, input.storeId)) throw new OpsDomainError("NOT_FOUND", "Store not found.");
  const id = `ust-operator-${input.key}`;
  if ((await svc.repository.listUstOperators({ organizationId: input.organizationId, storeIds: [input.storeId] })).some((row) => row.id === id)) return;
  const now = svc.clock?.now() ?? new Date().toISOString();
  const operator: UstOperator = { id, organizationId: input.organizationId, storeId: input.storeId, operatorClass: input.operatorClass as UstOperatorClass, name, certificateNumber: input.certificateNumber?.trim() || undefined, trainedOn, expiresOn, recordedByName: input.actor.actorName ?? "Team member", createdAt: now };
  await svc.repository.atomicWrite([
    insert("ops_ust_operators", { id, organization_id: operator.organizationId, store_id: operator.storeId, operator_class: operator.operatorClass, name: operator.name, certificate_number: operator.certificateNumber, trained_on: operator.trainedOn, expires_on: operator.expiresOn, recorded_by_name: operator.recordedByName, created_at: now }),
    audit(input.organizationId, operator, "store.ust_operator_added", input.actor, now),
  ]);
}

/** Marks an operator as no longer designated; the row stays for the record. */
export async function removeUstOperator(svc: OpsCommandServices, input: { organizationId: string; operatorId: string; actor: ActorContext; scope?: { storeIds?: string[]; regionIds?: string[] } }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "This store is outside your organization.");
  const operator = (await svc.repository.listUstOperators({ organizationId: input.organizationId, storeIds: input.scope?.storeIds, regionIds: input.scope?.regionIds })).find((row) => row.id === input.operatorId);
  if (!operator) return;
  const now = svc.clock?.now() ?? new Date().toISOString();
  await svc.repository.atomicWrite([
    { sql: "UPDATE ops_ust_operators SET removed_at = ?, removed_by_name = ? WHERE organization_id = ? AND id = ? AND removed_at IS NULL", params: [now, input.actor.actorName ?? "Team member", input.organizationId, operator.id] },
    audit(input.organizationId, operator, "store.ust_operator_removed", input.actor, now),
  ]);
}

/** Classes each store is missing, and operators whose training has expired or expires within 60 days. */
export function operatorGaps(operators: readonly UstOperator[], today: string) {
  const soon = new Date(Date.parse(today) + 60 * 86_400_000).toISOString().slice(0, 10);
  const active = operators.filter((row) => !row.removedAt);
  const has = (storeId: string, operatorClass: UstOperatorClass) => active.some((row) => row.storeId === storeId && row.operatorClass === operatorClass && (!row.expiresOn || row.expiresOn >= today));
  return {
    missing: (storeId: string) => (["A", "B", "C"] as const).filter((operatorClass) => !has(storeId, operatorClass)),
    expired: active.filter((row) => row.expiresOn && row.expiresOn < today),
    expiringSoon: active.filter((row) => row.expiresOn && row.expiresOn >= today && row.expiresOn <= soon),
  };
}

/**
 * Fictional fuel-tank story for the Clark Pump and Shop showcase: monthly leak detection on every store (one overdue,
 * one failed), yearly equipment tests with the fuel vendor, and Class A/B/C operators with one gap and one expiring.
 * Stable IDs; persisted records win during insert-only backfill. Work orders are prepared later by the inspection cycle.
 */
export function addUstDemo(f: OpsFixture): OpsFixture {
  const org = f.organizations[0]?.id;
  const stores = f.stores.filter((store) => store.organizationId === org && /^store-northline-1\d\d$/u.test(store.id));
  if (!org || stores.length !== 15 || !f.vendors.some((vendor) => vendor.id === "vendor-northline-forecourt")) return f;
  const day = (offset: number) => new Date(Date.parse(f.asOf) + offset * 86_400_000).toISOString().slice(0, 10);
  const at = (offset: number) => `${day(offset)}T15:00:00.000Z`;
  const monthly = COMPLIANCE_TEMPLATES.find((row) => row.key === "ust-monthly-leak-detection")!;
  const yearly = COMPLIANCE_TEMPLATES.find((row) => row.key === "ust-annual-equipment-test")!;
  f.complianceSchedules ??= [];
  f.inspections ??= [];
  f.ustOperators ??= [];
  const schedule = (key: string, store: string, template: typeof monthly, firstDue: number, vendor?: string) => {
    const id = `ust-demo-schedule-${key}`;
    if (f.complianceSchedules!.some((row) => row.id === id)) return id;
    f.complianceSchedules!.push({ id, organizationId: org, storeId: store, name: template.name, instructions: template.instructions, requirementSource: template.requirementSource, evidenceLabel: template.evidenceLabel, kind: template.kind, escalationDays: 0, escalationTo: "Facilities coordinator", firstDueDate: day(firstDue), intervalUnit: template.intervalUnit, intervalCount: template.intervalCount, leadDays: template.leadDays, handler: vendor ? "vendor" : "internal", vendorId: vendor, membershipId: vendor ? undefined : `membership-northline-store-${store.slice(-3)}`, evidenceRequired: template.evidenceRequired, status: "active", program: "ust", checklistJson: template.checklist ? JSON.stringify(template.checklist) : undefined, createdAt: at(-120) });
    return id;
  };
  const inspection = (scheduleId: string, store: string, due: number, status: "pending" | "passed" | "action_needed", note?: string) => {
    const id = `ust-demo-inspection-${scheduleId.slice("ust-demo-schedule-".length)}-${day(due)}`;
    if (f.inspections!.some((row) => row.id === id)) return;
    f.inspections!.push({ id, organizationId: org, scheduleId, storeId: store, dueDate: day(due), status, version: 0, createdAt: at(due - 7), completedAt: status === "pending" ? undefined : at(due - 1), resultNote: note, masterDocumentsJson: "[]" });
  };
  for (const store of stores) {
    const number = Number(store.storeNumber);
    const id = schedule(`monthly-${number}`, store.id, monthly, -30);
    inspection(id, store.id, -30, "passed", "Tank monitor report shows passing tests for every tank and line.");
    // Store 106 missed this month's check; store 111's line test failed and needs the fuel contractor.
    if (number === 111) inspection(id, store.id, -2, "action_needed", "Line leak test failed on the diesel line. Call the fuel contractor today.");
    else inspection(id, store.id, number === 106 ? -5 : 1 + (number % 9), "pending");
    if (number % 3 === 0) {
      const yearlyId = schedule(`yearly-${number}`, store.id, yearly, 40 + number % 20, "vendor-northline-forecourt");
      inspection(yearlyId, store.id, 40 + number % 20, "pending");
    }
    const operators: Array<[UstOperatorClass, string, number | undefined]> = [["A", "Jordan Lee", 900], ["B", "Chris Delgado", number === 108 ? 35 : 700]];
    // Store 109 has no Class C operator on record, so the page shows the gap.
    if (number !== 109) operators.push(["C", `Store ${number} manager`, undefined]);
    for (const [operatorClass, name, expiresIn] of operators) {
      const operatorId = `ust-demo-operator-${number}-${operatorClass.toLowerCase()}`;
      if (f.ustOperators.some((row) => row.id === operatorId)) continue;
      const manager = f.users.find((user) => user.id === `user-northline-store-${number}`)?.displayName;
      f.ustOperators.push({ id: operatorId, organizationId: org, storeId: store.id, operatorClass, name: operatorClass === "C" ? manager ?? name : name, certificateNumber: operatorClass === "C" ? undefined : `UST-${operatorClass}-${4000 + number}`, trainedOn: day(-300), expiresOn: expiresIn === undefined ? undefined : day(expiresIn), recordedByName: "Fictional demo setup", createdAt: at(-300) });
    }
  }
  return f;
}
