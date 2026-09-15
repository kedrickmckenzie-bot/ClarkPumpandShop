import "server-only";
import { notFound } from "next/navigation";
import { roleCan, roleCanAccessProgramRoute } from "@/components/ops/role-policy";
import { getServerOpsRepository, getServerOpsReportingAsOf } from "@/lib/server/ops-repository-provider";
import { readPmOccurrenceRecord } from "@/lib/ops/pm-record-query";
import { effectivePmStatus } from "@/lib/ops/pm-occurrence-state";
import { briefPmState } from "@/lib/ops/owner-brief-query";
import { loadOperatorSession } from "./operator-loader";
import { compactStoreLabel } from "@/lib/product/store-label";

export async function loadPmOccurrenceRecord(id: string, requestedPage?: string) {
  const session = await loadOperatorSession();
  if (!roleCanAccessProgramRoute(session.role, "pm")) notFound();
  const repository = await getServerOpsRepository();
  const record = await readPmOccurrenceRecord(repository, session, id);
  if (!record) notFound();
  const parsed = Number(requestedPage ?? 1);
  const page = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : 1;
  const visits = record.work ? await repository.listWorkVisitEvidence(session, record.work.id, { limit: 25, offset: (page - 1) * 25 }) : { items: [], totalCount: 0 };
  const asOf = getServerOpsReportingAsOf();
  const timing = briefPmState(record.occurrence, asOf);
  const status = timing.startsWith("completed") || timing === "cancelled" || timing === "waived" ? timing : effectivePmStatus(record.occurrence, asOf);
  return {
    ...record, visits, page, status, storeLabel: compactStoreLabel(`Store ${record.store.storeNumber} · ${record.store.name}`, session.organizationName),
    canAdjustPlan: roleCan(session, "setup_pm") && record.plan?.storeId === record.store.id,
    canCreateWork: roleCan(session, "create_work_order"),
  };
}
