import type { OpsStatement } from "./repository";
import type { OpsFixture } from "./types";
import {
  DEMO_ORGANIZATION_NAME,
  DEMO_VENDOR_NAMES,
  NORTHLINE_AS_OF,
  NORTHLINE_ORGANIZATION_ID,
} from "./fixtures";

/**
 * A fixture version names the exact source facts written to an empty database.
 * It is not a migration number. Historical fixture rows may have accumulated
 * real preview mutations, so a new fixture version never merges or reprojects
 * records underneath an older completed bootstrap.
 */
export const NORTHLINE_SEED_VERSION = "northline-ops-2026-08-27-v15";

/**
 * An older completed fixture is enriched only with missing deterministic rows.
 * Existing IDs and user mutations are never overwritten. This separate
 * receipt remains honest that the database was not freshly seeded as v15.
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
  const storeNames = [
    "Cedar Grove", "Riverside", "Oak Valley", "Ridgeview", "Westgate",
    "Harbor Point", "Junction City", "Meadow Park", "Lakeview", "Eastfield",
    "Pine Hills", "Maple Crossing", "Riverbend", "North Market", "Southgate",
  ];
  const vendorIdentity = [
    ["vendor-northline-summit", "summit", "coldline", "Summit Refrigeration", DEMO_VENDOR_NAMES.summit, "service@summit-demo.example", "service@coldline-demo.example"],
    ["vendor-northline-cedar", "cedar", "clearflow", "Cedar Mechanical", DEMO_VENDOR_NAMES.cedar, "dispatch@cedar-demo.example", "dispatch@clearflow-demo.example"],
    ["vendor-northline-forecourt", "forecourt", "pumppro", "Forecourt Systems Group", DEMO_VENDOR_NAMES.forecourt, "dispatch@forecourt-demo.example", "dispatch@pumppro-demo.example"],
    ["vendor-northline-brightpath", "brightpath", "brightline", "BrightPath Electrical", DEMO_VENDOR_NAMES.brightpath, "service@brightpath-demo.example", "service@brightline-demo.example"],
    ["vendor-northline-four-seasons", "four-seasons", "greenlot", "Four Seasons Site Services", DEMO_VENDOR_NAMES.fourSeasons, "dispatch@four-seasons-demo.example", "dispatch@greenlot-demo.example"],
  ] as const;
  const identityAmendments: OpsStatement[] = [
    {
      sql: `UPDATE ops_organizations
        SET name = ?, slug = ?, work_order_prefix = ?
        WHERE id = ? AND name = ? AND slug = ? AND work_order_prefix = ?`,
      params: [DEMO_ORGANIZATION_NAME, "clark-pump-shop-demo", "CPS", NORTHLINE_ORGANIZATION_ID, "Northline Fuel & Market", "northline-demo", "NL"],
    },
    ...storeNames.map((location): OpsStatement => ({
      sql: `UPDATE ops_stores
        SET name = ?, search_text = REPLACE(search_text, ?, ?)
        WHERE organization_id = ? AND name = ?`,
      params: [`${DEMO_ORGANIZATION_NAME} - ${location}`, "northline", "clark pump and shop", NORTHLINE_ORGANIZATION_ID, `Northline ${location}`],
    })),
    ...vendorIdentity.map(([id, oldCode, newCode, oldName, newName, oldEmail, newEmail]): OpsStatement => ({
      sql: `UPDATE ops_vendors
        SET code = ?, name = ?, dispatch_email = ?, search_text = REPLACE(REPLACE(search_text, ?, ?), ?, ?)
        WHERE organization_id = ? AND id = ? AND code = ? AND name = ? AND dispatch_email = ?`,
      params: [newCode, newName, newEmail, oldName.toLocaleLowerCase("en-US"), newName.toLocaleLowerCase("en-US"), oldCode, newCode, NORTHLINE_ORGANIZATION_ID, id, oldCode, oldName, oldEmail],
  })),
    {
      // An earlier demo release treated access to payment-enabled fuel
      // equipment as suspicious by itself. Vendor accountability should flag
      // the missing authorization and location evidence instead, so remove
      // only that exact obsolete fixture exception from existing previews.
      sql: `DELETE FROM ops_exceptions
        WHERE organization_id = ? AND id = ? AND kind = ? AND summary = ?`,
      params: [
        NORTHLINE_ORGANIZATION_ID,
        "exception-northline-107-high-risk",
        "high_risk_service",
        "Unexpected access to payment-enabled fuel equipment requires manager review",
      ],
    },
  ];
  const workflowAmendments: OpsStatement[] = [{
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
      "waiting_on_vendor", "Facilities coordinator", "Accept or counter ColdLine's proposed service date",
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
      "schedule_service", "Accept or counter ColdLine's proposed service date",
      "ColdLine proposed a service window that needs an operator scheduling decision.",
      "role", "facilities_admin", "Facilities coordinator", "2026-08-25T17:15:00.000Z", "scheduling",
      "The proposed service date is accepted or a store-local counterproposal is sent.", "Facilities director",
      NORTHLINE_ORGANIZATION_ID, "wo-current-113-freezer-service",
      "Arrive for the confirmed service window and record check-in",
    ],
  }];
  return [...identityAmendments, ...workflowAmendments];
}
