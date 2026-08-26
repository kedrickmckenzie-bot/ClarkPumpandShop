import type { OpsStatement } from "./repository";
import type { OpsFixture } from "./types";
import {
  NORTHLINE_AS_OF,
  NORTHLINE_ORGANIZATION_ID,
} from "./fixtures";

/**
 * A fixture version names the exact source facts written to an empty database.
 * It is not a migration number. Historical fixture rows may have accumulated
 * real preview mutations, so a new fixture version never merges or reprojects
 * records underneath an older completed bootstrap.
 */
export const NORTHLINE_SEED_VERSION = "northline-ops-2026-08-25-v13";

/**
 * An older completed fixture is enriched only with missing deterministic rows.
 * Existing IDs and user mutations are never overwritten. This separate
 * receipt remains honest that the database was not freshly seeded as v13.
 */
export const NORTHLINE_SEED_COMPATIBILITY_MARKER = `${NORTHLINE_SEED_VERSION}:enriched-existing`;

export const NORTHLINE_BOOTSTRAP_COMMAND = "bootstrap_ops_fixture";
export const NORTHLINE_COMPATIBILITY_COMMAND = "enrich_existing_ops_fixture";

export interface NorthlineSeedMarkerRow extends Record<string, unknown> {
  key: string;
  command: string;
  result_id?: string;
}

export type NorthlineSeedReleasePlan =
  | { kind: "already_current" }
  | { kind: "already_enriched" }
  | { kind: "seed_current" }
  | { kind: "enrich_existing"; sourceVersion: string };

/**
 * Selects one deterministic release action from completed bootstrap receipts.
 * Callers query only bootstrap/compatibility receipts for the Northline tenant.
 */
export function planNorthlineSeedRelease(
  markers: readonly NorthlineSeedMarkerRow[],
): NorthlineSeedReleasePlan {
  if (markers.some((marker) => marker.key === NORTHLINE_SEED_VERSION)) {
    return { kind: "already_current" };
  }
  if (markers.some((marker) => marker.key === NORTHLINE_SEED_COMPATIBILITY_MARKER)) {
    return { kind: "already_enriched" };
  }

  const prior = markers.find((marker) =>
    marker.command === NORTHLINE_BOOTSTRAP_COMMAND
    || marker.command === NORTHLINE_COMPATIBILITY_COMMAND
  );
  if (prior) return { kind: "enrich_existing", sourceVersion: prior.key };
  return { kind: "seed_current" };
}

export interface ExistingVisitWorkIdentity {
  organizationId: string;
  id: string;
  visitId: string;
  workOrderId: string;
}

/**
 * Migration 0018 generated compatibility IDs for legacy scalar visit links.
 * Reuse those identities when enriching an existing tenant so new dependent
 * evidence can be inserted without rewriting either the link or user data.
 */
export function remapNorthlineFixtureVisitWorkIds(fixture: OpsFixture, existing: readonly ExistingVisitWorkIdentity[]) {
  const clone = structuredClone(fixture);
  const existingByContext = new Map(existing.map((row) => [`${row.organizationId}|${row.visitId}|${row.workOrderId}`, row.id]));
  const idMap = new Map<string, string>();
  clone.siteVisitWorkOrders = clone.siteVisitWorkOrders.map((row) => {
    const id = existingByContext.get(`${row.organizationId}|${row.visitId}|${row.workOrderId}`) ?? row.id;
    idMap.set(row.id, id);
    return { ...row, id };
  });
  clone.workOrderVerifications = clone.workOrderVerifications.map((row) => ({ ...row, siteVisitWorkOrderId: idMap.get(row.siteVisitWorkOrderId) ?? row.siteVisitWorkOrderId }));
  clone.repairItems = clone.repairItems.map((row) => ({ ...row, siteVisitWorkOrderId: idMap.get(row.siteVisitWorkOrderId) ?? row.siteVisitWorkOrderId }));
  clone.invoiceLineAllocations = clone.invoiceLineAllocations.map((row) => ({ ...row, siteVisitWorkOrderId: row.siteVisitWorkOrderId ? idMap.get(row.siteVisitWorkOrderId) ?? row.siteVisitWorkOrderId : undefined }));
  clone.serviceDiscrepancies = clone.serviceDiscrepancies.map((row) => ({ ...row, siteVisitWorkOrderId: row.siteVisitWorkOrderId ? idMap.get(row.siteVisitWorkOrderId) ?? row.siteVisitWorkOrderId : undefined }));
  return clone;
}

export function buildNorthlineCurrentSeedMarker(): OpsStatement {
  return {
    sql: `INSERT OR IGNORE INTO ops_idempotency_keys
      (organization_id, key, command, result_id, request_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params: [
      NORTHLINE_ORGANIZATION_ID,
      NORTHLINE_SEED_VERSION,
      NORTHLINE_BOOTSTRAP_COMMAND,
      NORTHLINE_ORGANIZATION_ID,
      NORTHLINE_SEED_VERSION,
      NORTHLINE_AS_OF,
      "9999-12-31T23:59:59.999Z",
    ],
  };
}

export function buildNorthlineCompatibilityMarker(sourceVersion: string): OpsStatement {
  return {
    sql: `INSERT OR IGNORE INTO ops_idempotency_keys
      (organization_id, key, command, result_id, request_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params: [
      NORTHLINE_ORGANIZATION_ID,
      NORTHLINE_SEED_COMPATIBILITY_MARKER,
      NORTHLINE_COMPATIBILITY_COMMAND,
      sourceVersion,
      NORTHLINE_SEED_VERSION,
      NORTHLINE_AS_OF,
      "9999-12-31T23:59:59.999Z",
    ],
  };
}

/**
 * Narrow amendments for deterministic Northline facts whose stable IDs existed
 * before their structured replacement history. Every predicate includes the
 * exact legacy identity, so user edits and unrelated tenant data are untouched.
 */
export function buildNorthlineCompatibilityAmendments(): OpsStatement[] {
  return [{
    sql: `UPDATE ops_asset_components
      SET serial_number = ?, installed_at = ?, warranty_ends_at = ?
      WHERE organization_id = ?
        AND id = ?
        AND asset_id = ?
        AND part_number = ?
        AND serial_number = ?
        AND installed_at = ?
        AND warranty_ends_at = ?
        AND removed_at IS NULL`,
    params: [
      "CMP104-2026-0710",
      "2026-07-10T12:00:00.000Z",
      "2028-07-10T12:00:00.000Z",
      NORTHLINE_ORGANIZATION_ID,
      "component-104-compressor",
      "asset-104-beer-cave",
      "ZB38KCE-TFD",
      "CMP104-88214",
      "2021-05-06T12:00:00.000Z",
      "2026-05-06T12:00:00.000Z",
    ],
  }, {
    // v12 accidentally projected a vendor-proposed date as already accepted.
    // Repair only the untouched deterministic row; a real operator
    // continuation always wins and is never rewritten by fixture enrichment.
    sql: `UPDATE ops_work_orders
      SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ?
      WHERE organization_id = ? AND id = ?
        AND status = ? AND accountable_party = ? AND next_action = ? AND due_at = ?
        AND NOT EXISTS (
          SELECT 1 FROM ops_vendor_continuations c
          WHERE c.organization_id = ops_work_orders.organization_id
            AND c.work_order_id = ops_work_orders.id
        )`,
    params: [
      "waiting_on_vendor", "Facilities coordinator", "Accept or counter Summit's proposed service date",
      "2026-08-25T17:15:00.000Z", "Facilities director",
      NORTHLINE_ORGANIZATION_ID, "wo-current-113-freezer-service",
      "scheduled", "Summit Refrigeration", "Arrive for the confirmed service window and record check-in",
      "2026-08-12T14:00:00.000Z",
    ],
  }, {
    sql: `UPDATE ops_work_order_assignments
      SET status = ?
      WHERE organization_id = ? AND id = ? AND status = ?
        AND NOT EXISTS (
          SELECT 1 FROM ops_vendor_continuations c
          WHERE c.organization_id = ops_work_order_assignments.organization_id
            AND c.work_order_id = ops_work_order_assignments.work_order_id
        )`,
    params: ["issued", NORTHLINE_ORGANIZATION_ID, "assignment-current-113-freezer-service", "accepted"],
  }, {
    sql: `UPDATE ops_vendor_responses
      SET proposed_at = ?, message = ?, responded_at = ?
      WHERE organization_id = ? AND id = ?
        AND proposed_at = ? AND responded_at = ?
        AND NOT EXISTS (
          SELECT 1 FROM ops_vendor_continuations c
          WHERE c.organization_id = ops_vendor_responses.organization_id
            AND c.vendor_response_id = ops_vendor_responses.id
        )`,
    params: [
      "2026-08-28T14:00:00.000Z", "Defrost technician and controller stock are available Friday afternoon.",
      "2026-08-25T09:15:00.000Z", NORTHLINE_ORGANIZATION_ID, "response-current-113-proposed-date",
      "2026-08-12T14:00:00.000Z", "2026-08-10T09:15:00.000Z",
    ],
  }, {
    sql: `UPDATE ops_workflow_tasks
      SET task_type = ?, title = ?, reason = ?, assignee_type = ?, assignee_id = NULL,
          assignee_role = ?, assignee_name = ?, due_at = ?, applicable_sla_clock = ?,
          completion_criteria = ?, escalation_destination = ?
      WHERE organization_id = ? AND work_order_id = ?
        AND status IN ('open', 'in_progress')
        AND title = ?
        AND NOT EXISTS (
          SELECT 1 FROM ops_vendor_continuations c
          WHERE c.organization_id = ops_workflow_tasks.organization_id
            AND c.work_order_id = ops_workflow_tasks.work_order_id
        )`,
    params: [
      "schedule_service", "Accept or counter Summit's proposed service date",
      "Summit proposed a service window that needs an operator scheduling decision.",
      "role", "facilities_admin", "Facilities coordinator", "2026-08-25T17:15:00.000Z", "scheduling",
      "The proposed service date is accepted or a store-local counterproposal is sent.", "Facilities director",
      NORTHLINE_ORGANIZATION_ID, "wo-current-113-freezer-service",
      "Arrive for the confirmed service window and record check-in",
    ],
  }];
}
