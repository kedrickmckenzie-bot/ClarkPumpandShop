import "server-only";

import { getD1Binding } from "@/db";
import { createOpsD1Repository } from "@/lib/ops/d1-repository";
import { loadOpsFixtureSnapshotFromD1 } from "@/lib/ops/d1-snapshot";
import { getNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  buildNorthlinePresentationFixture,
  NORTHLINE_AS_OF,
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";
import type { OpsRepository } from "@/lib/ops/repository";
import { seedOpsRepository } from "@/lib/ops/seed";
import type { OpsFixture, OpsId } from "@/lib/ops/types";

const NORTHLINE_SEED_VERSION = "northline-ops-2026-08-10-v2";
let durableRepository: Promise<OpsRepository> | undefined;
let repositoryProxy: OpsRepository | undefined;

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

export async function getServerOpsRepository(): Promise<OpsRepository> {
  const binding = getD1Binding();
  if (binding) {
    durableRepository ??= (async () => {
      const repository = createOpsD1Repository(binding);
      await ensureNorthlineSeed(binding, repository);
      return repository;
    })();
    return durableRepository;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("TraceOps requires the Cloudflare D1 `DB` binding in production; fixture fallback is disabled.");
  }
  return getNorthlineFixtureRepository();
}

/** A lazy server proxy for modules whose public contract is created eagerly. */
export function getServerOpsRepositoryProxy(): OpsRepository {
  repositoryProxy ??= new Proxy(
    { kind: getD1Binding() ? "d1" : "fixture" } as OpsRepository,
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
  const binding = getD1Binding();
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
