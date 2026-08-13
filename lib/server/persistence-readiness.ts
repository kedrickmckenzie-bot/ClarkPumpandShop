import "server-only";

import { getPostgresPool } from "@/lib/server/postgres-pool";
import {
  isLocalRenderDevelopment,
  isRenderNodeRuntime,
} from "@/lib/server/persistence-runtime";

export interface PersistenceReadiness {
  ready: boolean;
  checks: Record<string, string>;
}

async function getD1BindingLazily() {
  const d1Module = await import("@/db");
  return d1Module.getD1Binding();
}

/** A small, runtime-neutral database probe for `/api/ready`. */
export async function checkPersistenceReadiness(): Promise<PersistenceReadiness> {
  let backend: "postgresql" | "d1" | "fixture" = "fixture";
  try {
    if (process.env.DATABASE_URL?.trim()) {
      backend = "postgresql";
      const pool = await getPostgresPool();
      await pool.query("SELECT 1 AS ready");
      return { ready: true, checks: { persistence: "postgresql:ready" } };
    }

    if (isRenderNodeRuntime()) {
      if (isLocalRenderDevelopment()) {
        return { ready: true, checks: { persistence: "fixture:development-only" } };
      }
      return { ready: false, checks: { persistence: "missing DATABASE_URL" } };
    }

    const binding = await getD1BindingLazily();
    if (binding) {
      backend = "d1";
      await binding.prepare("SELECT 1 AS ready").first();
      return { ready: true, checks: { persistence: "d1:ready" } };
    }

    if (process.env.NODE_ENV !== "production") {
      return { ready: true, checks: { persistence: "fixture:development-only" } };
    }

    return { ready: false, checks: { persistence: "missing durable database" } };
  } catch {
    return {
      ready: false,
      checks: { persistence: `${backend}:unavailable` },
    };
  }
}
