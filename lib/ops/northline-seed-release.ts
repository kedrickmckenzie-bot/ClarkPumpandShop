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
export const NORTHLINE_SEED_VERSION = "northline-ops-2026-08-20-v11";

/**
 * An older completed fixture is enriched only with missing deterministic rows.
 * Existing IDs and user mutations are never overwritten. This separate
 * receipt remains honest that the database was not freshly seeded as v11.
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
