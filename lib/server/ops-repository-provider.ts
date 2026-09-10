import { TREND_SOURCE_TABLES } from "@/lib/ops/trends-source-tables";
import "server-only";

import { createOpsD1Repository } from "@/lib/ops/d1-repository";
import { loadOpsFixtureSnapshotFromD1 } from "@/lib/ops/d1-snapshot";
import { getNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  buildNorthlinePresentationFixture,
  NORTHLINE_AS_OF,
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";
import { ensureNorthlinePostgresSeed } from "@/lib/ops/northline-postgres-bootstrap";
import { createOpsPostgresRepository } from "@/lib/ops/postgres-repository";
import type { OpsRepository } from "@/lib/ops/repository";
import { seedOpsRepository } from "@/lib/ops/seed";
import {
  buildNorthlineCompatibilityAmendments,
  buildNorthlineCompatibilityMarker,
  buildNorthlineCurrentSeedMarker,
  NORTHLINE_BOOTSTRAP_COMMAND,
  NORTHLINE_COMPATIBILITY_COMMAND,
  NORTHLINE_SEED_COMPATIBILITY_MARKER,
  NORTHLINE_SEED_VERSION,
  planNorthlineSeedRelease,
  remapNorthlineFixtureVisitWorkIds,
  type NorthlineSeedMarkerRow,
} from "@/lib/ops/northline-seed-release";
import type { OpsFixture, OpsId } from "@/lib/ops/types";
import { getPostgresPool } from "@/lib/server/postgres-pool";
import {
  isLocalRenderDevelopment,
  isRenderNodeRuntime,
} from "@/lib/server/persistence-runtime";

let durableRepository: Promise<OpsRepository> | undefined;
let repositoryProxy: OpsRepository | undefined;

export type OpsRepositoryBackend = "postgres" | "d1" | "fixture";

export function selectOpsRepositoryBackend(input: {
  databaseUrl?: string;
  d1Available: boolean;
  nodeEnv?: string;
  allowLocalD1?: boolean;
}): OpsRepositoryBackend {
  if (input.databaseUrl?.trim()) return "postgres";
  // The product contract deliberately keeps ordinary local development on a
  // resettable fixture. Vinext exposes a D1 binding in development even when
  // the developer's local sqlite file is several migrations behind; treating
  // the mere presence of that binding as intent made record pages fail at
  // runtime. D1 remains available as an explicit adapter-integration mode.
  if (input.nodeEnv !== "production" && !input.allowLocalD1) return "fixture";
  if (input.d1Available) return "d1";
  throw new Error("The production facilities platform requires PostgreSQL DATABASE_URL or the Cloudflare D1 `DB` binding.");
}

function localD1Requested() {
  return process.env.OPS_LOCAL_D1 === "1";
}

function shouldUseDevelopmentFixture() {
  return process.env.NODE_ENV !== "production" && !localD1Requested();
}

async function getD1BindingLazily(): Promise<D1Database | undefined> {
  // Import the Cloudflare-only module only on the Sites/D1 path. Render starts
  // with DATABASE_URL and never evaluates `cloudflare:workers`.
  const d1Module = await import("@/db");
  return d1Module.getD1Binding();
}

async function ensureNorthlineSeed(binding: D1Database, repository: OpsRepository) {
  let markers: NorthlineSeedMarkerRow[];
  try {
    const result = await binding
      .prepare(`SELECT key, command, result_id FROM ops_idempotency_keys
        WHERE organization_id = ?
          AND (key IN (?, ?) OR command IN (?, ?))
        ORDER BY created_at DESC, key DESC`)
      .bind(
        NORTHLINE_ORGANIZATION_ID,
        NORTHLINE_SEED_VERSION,
        NORTHLINE_SEED_COMPATIBILITY_MARKER,
        NORTHLINE_BOOTSTRAP_COMMAND,
        NORTHLINE_COMPATIBILITY_COMMAND,
      )
      .all<NorthlineSeedMarkerRow>();
    markers = result.results ?? [];
  } catch (error) {
    throw new Error(
      "D1 is bound but the operations migration is not applied. Apply drizzle/0004_ops_platform_foundation.sql before serving the application.",
      { cause: error },
    );
  }
  const plan = planNorthlineSeedRelease(markers);
  if (plan.kind === "already_current" || plan.kind === "already_enriched") return;

  if (plan.kind === "enrich_existing") {
    const links = await binding.prepare(`SELECT organization_id, id, visit_id, work_order_id
      FROM ops_site_visit_work_orders WHERE organization_id = ?`).bind(NORTHLINE_ORGANIZATION_ID).all<{
        organization_id: string; id: string; visit_id: string; work_order_id: string;
      }>();
    const fixture = remapNorthlineFixtureVisitWorkIds(buildNorthlinePresentationFixture(), (links.results ?? []).map((row) => ({
      organizationId: row.organization_id, id: row.id, visitId: row.visit_id, workOrderId: row.work_order_id,
    })));
    // Every source statement is INSERT OR IGNORE: existing facts and user
    // mutations win, while missing demo capabilities receive source records.
    await seedOpsRepository(repository, fixture);
    await repository.atomicWrite([
      ...buildNorthlineCompatibilityAmendments(),
      buildNorthlineCompatibilityMarker(plan.sourceVersion),
    ]);
    return;
  }

  // INSERT OR IGNORE makes bootstrap restartable after a partial failure and
  // safe when fresh isolates running this same release race. The completion
  // marker is written last. Cross-release initialization is an operational
  // deployment boundary because D1 has no cross-version application lock.
  await seedOpsRepository(repository, buildNorthlinePresentationFixture());
  await repository.atomicWrite([buildNorthlineCurrentSeedMarker()]);
}

function initializeDurableRepository(factory: () => Promise<OpsRepository>) {
  if (!durableRepository) {
    const attempt = factory();
    const recoverable = attempt.catch((error) => {
      // A transient database/bootstrap failure must not poison this process for
      // its remaining lifetime. Preserve one shared in-flight initialization,
      // then allow the next request to retry after a rejection.
      if (durableRepository === recoverable) durableRepository = undefined;
      throw error;
    });
    durableRepository = recoverable;
  }
  return durableRepository;
}

export async function getServerOpsRepository(): Promise<OpsRepository> {
  if (process.env.DATABASE_URL?.trim()) {
    return initializeDurableRepository(async () => {
      const pool = await getPostgresPool();
      const repository = createOpsPostgresRepository(pool);
      await ensureNorthlinePostgresSeed(pool);
      return repository;
    });
  }

  if (isRenderNodeRuntime()) {
    if (isLocalRenderDevelopment()) return getNorthlineFixtureRepository();
    throw new Error("The Render runtime requires DATABASE_URL; fixture and D1 fallbacks are disabled.");
  }

  if (shouldUseDevelopmentFixture()) return getNorthlineFixtureRepository();

  const binding = await getD1BindingLazily();
  if (binding) {
    return initializeDurableRepository(async () => {
      const repository = createOpsD1Repository(binding);
      await ensureNorthlineSeed(binding, repository);
      return repository;
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("The production runtime requires the Cloudflare D1 `DB` binding; fixture fallback is disabled.");
  }
  return getNorthlineFixtureRepository();
}

/** A lazy server proxy for modules whose public contract is created eagerly. */
export function getServerOpsRepositoryProxy(): OpsRepository {
  const proxyKind: OpsRepository["kind"] = process.env.DATABASE_URL?.trim()
    ? "postgres"
    : isRenderNodeRuntime()
      ? isLocalRenderDevelopment() ? "fixture" : "postgres"
      : shouldUseDevelopmentFixture() ? "fixture" : "d1";
  repositoryProxy ??= new Proxy(
    { kind: proxyKind } as OpsRepository,
    {
      get(target, property) {
        if (property === "kind") return target.kind;
        return (...args: unknown[]) => getServerOpsRepository().then((repository) => {
          const member = Reflect.get(repository, property);
          if (typeof member !== "function") return member;
          return Reflect.apply(member, repository, args);
        });
      },
    },
  );
  return repositoryProxy;
}

export async function getServerOpsFixtureSnapshot(
  organizationId: OpsId = NORTHLINE_ORGANIZATION_ID,
): Promise<OpsFixture> {
  if (process.env.DATABASE_URL?.trim()) {
    const pool = await getPostgresPool();
    await getServerOpsRepository();
    const { loadOpsFixtureSnapshotFromPostgres } = await import("@/lib/ops/postgres-snapshot");
    return loadOpsFixtureSnapshotFromPostgres(pool, organizationId, NORTHLINE_AS_OF);
  }

  if (isRenderNodeRuntime()) {
    if (isLocalRenderDevelopment()) return getNorthlineFixtureRepository().snapshot();
    throw new Error("The Render runtime requires DATABASE_URL; operator data cannot use a fallback.");
  }

  if (shouldUseDevelopmentFixture()) return getNorthlineFixtureRepository().snapshot();

  const binding = await getD1BindingLazily();
  if (!binding) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Operator data cannot load without the Cloudflare D1 `DB` binding.");
    }
    return getNorthlineFixtureRepository().snapshot();
  }
  await getServerOpsRepository();
  return loadOpsFixtureSnapshotFromD1(binding, organizationId, NORTHLINE_AS_OF);
}



/**
 * Compatibility projection for the Trends presenter.
 *
 * PostgreSQL loads only the source tables the analysis consumes instead of the
 * complete operational tenant (files, audit, outbox, contracts, warranties,
 * and other unrelated domains). PostgreSQL and D1 use the same explicit
 * reporting table boundary; local fixtures remain an isolated adapter.
 */
export async function getServerOpsTrendsFixtureSnapshot(
  organizationId: OpsId = NORTHLINE_ORGANIZATION_ID,
): Promise<OpsFixture> {
  if (process.env.DATABASE_URL?.trim()) {
    const pool = await getPostgresPool();
    await getServerOpsRepository();
    const { loadOpsFixtureSnapshotFromPostgres } = await import("@/lib/ops/postgres-snapshot");
    return loadOpsFixtureSnapshotFromPostgres(pool, organizationId, NORTHLINE_AS_OF, { includedTables: TREND_SOURCE_TABLES, auditEventTypes: ["recording.coverage_attested"] });
  }
  if (isRenderNodeRuntime() || shouldUseDevelopmentFixture()) return getServerOpsFixtureSnapshot(organizationId);
  const binding = await getD1BindingLazily();
  if (binding) {
    await getServerOpsRepository();
    return loadOpsFixtureSnapshotFromD1(binding, organizationId, NORTHLINE_AS_OF, { includedTables: TREND_SOURCE_TABLES, auditEventTypes: ["recording.coverage_attested"] });
  }
  return getServerOpsFixtureSnapshot(organizationId);
}

export function resetServerOpsRepositoryForTests() {
  durableRepository = undefined;
  repositoryProxy = undefined;
}
