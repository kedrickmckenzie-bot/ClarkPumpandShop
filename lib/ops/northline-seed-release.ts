import type { OpsStatement } from "./repository";
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
export const NORTHLINE_SEED_VERSION = "northline-ops-2026-08-20-v10";

/**
 * An older completed fixture is intentionally preserved in place. This
 * separate receipt prevents every process start from retrying the release
 * while remaining honest that the database was not freshly seeded as v10.
 */
export const NORTHLINE_SEED_COMPATIBILITY_MARKER = `${NORTHLINE_SEED_VERSION}:preserved-existing`;

export const NORTHLINE_BOOTSTRAP_COMMAND = "bootstrap_ops_fixture";
export const NORTHLINE_COMPATIBILITY_COMMAND = "preserve_existing_ops_fixture";

export interface NorthlineSeedMarkerRow extends Record<string, unknown> {
  key: string;
  command: string;
  result_id?: string;
}

export type NorthlineSeedReleasePlan =
  | { kind: "already_current" }
  | { kind: "already_preserved" }
  | { kind: "seed_current" }
  | { kind: "preserve_existing"; sourceVersion: string };

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
    return { kind: "already_preserved" };
  }

  const prior = markers.find((marker) =>
    marker.command === NORTHLINE_BOOTSTRAP_COMMAND
    || marker.command === NORTHLINE_COMPATIBILITY_COMMAND
  );
  if (prior) return { kind: "preserve_existing", sourceVersion: prior.key };
  return { kind: "seed_current" };
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
