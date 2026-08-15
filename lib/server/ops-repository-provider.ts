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
import type { OpsFixture, OpsId } from "@/lib/ops/types";
import { getPostgresPool } from "@/lib/server/postgres-pool";
import {
  isLocalRenderDevelopment,
  isRenderNodeRuntime,
} from "@/lib/server/persistence-runtime";

const NORTHLINE_SEED_VERSION = "northline-ops-2026-08-15-v9";
let durableRepository: Promise<OpsRepository> | undefined;
let repositoryProxy: OpsRepository | undefined;

export type OpsRepositoryBackend = "postgres" | "d1" | "fixture";

export function selectOpsRepositoryBackend(input: {
  databaseUrl?: string;
  d1Available: boolean;
  nodeEnv?: string;
}): OpsRepositoryBackend {
  if (input.databaseUrl?.trim()) return "postgres";
  if (input.d1Available) return "d1";
  if (input.nodeEnv !== "production") return "fixture";
  throw new Error("TraceOps production requires PostgreSQL DATABASE_URL or the Cloudflare D1 `DB` binding.");
}

async function getD1BindingLazily(): Promise<D1Database | undefined> {
  // Import the Cloudflare-only module only on the Sites/D1 path. Render starts
  // with DATABASE_URL and never evaluates `cloudflare:workers`.
  const d1Module = await import("@/db");
  return d1Module.getD1Binding();
}

async function ensureNorthlineSeed(binding: D1Database, repository: OpsRepository) {
  let marker: Record<string, unknown> | null;
  try {
    marker = await binding
      .prepare("SELECT result_id FROM ops_idempotency_keys WHERE organization_id = ? AND key = ? LIMIT 1")
      .bind(NORTHLINE_ORGANIZATION_ID, NORTHLINE_SEED_VERSION)
      .first<Record<string, unknown>>();
  } catch (error) {
    throw new Error(
      "TraceOps D1 is bound but the ops migration is not applied. Apply drizzle/0004_ops_platform_foundation.sql before serving the application.",
      { cause: error },
    );
  }
  if (marker) return;

  // INSERT OR IGNORE makes bootstrap restartable after a partial failure and
  // safe when two fresh isolates race. The completion marker is written last.
  await seedOpsRepository(repository, buildNorthlinePresentationFixture());
  await repository.atomicWrite([{
    sql: `INSERT OR IGNORE INTO ops_idempotency_keys
      (organization_id, key, command, result_id, request_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params: [
      NORTHLINE_ORGANIZATION_ID,
      NORTHLINE_SEED_VERSION,
      "bootstrap_ops_fixture",
      NORTHLINE_ORGANIZATION_ID,
      NORTHLINE_SEED_VERSION,
      NORTHLINE_AS_OF,
      "9999-12-31T23:59:59.999Z",
    ],
  }]);
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
    throw new Error("TraceOps Render runtime requires DATABASE_URL; fixture and D1 fallbacks are disabled.");
  }

  const binding = await getD1BindingLazily();
  if (binding) {
    return initializeDurableRepository(async () => {
      const repository = createOpsD1Repository(binding);
      await ensureNorthlineSeed(binding, repository);
      return repository;
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("TraceOps requires the Cloudflare D1 `DB` binding in production; fixture fallback is disabled.");
  }
  return getNorthlineFixtureRepository();
}

/** A lazy server proxy for modules whose public contract is created eagerly. */
export function getServerOpsRepositoryProxy(): OpsRepository {
  const proxyKind: OpsRepository["kind"] = process.env.DATABASE_URL?.trim()
    ? "postgres"
    : isRenderNodeRuntime()
      ? isLocalRenderDevelopment() ? "fixture" : "postgres"
      : "d1";
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
    throw new Error("TraceOps Render runtime requires DATABASE_URL; operator data cannot use a fallback.");
  }

  const binding = await getD1BindingLazily();
  if (!binding) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TraceOps cannot load operator data without the Cloudflare D1 `DB` binding.");
    }
    return getNorthlineFixtureRepository().snapshot();
  }
  await getServerOpsRepository();
  return loadOpsFixtureSnapshotFromD1(binding, organizationId, NORTHLINE_AS_OF);
}

export function resetServerOpsRepositoryForTests() {
  durableRepository = undefined;
  repositoryProxy = undefined;
}
