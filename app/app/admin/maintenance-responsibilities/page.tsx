import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaintenanceResponsibilities } from "@/components/workspace/maintenance-responsibilities";
import { roleCan } from "@/components/ops/role-policy";
import { loadOperatorSession } from "../../_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";

export const metadata: Metadata = { title: "Maintenance responsibilities" };
type Query = { notice?: string | string[] };

export default async function MaintenanceResponsibilitiesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [session, query, repository] = await Promise.all([loadOperatorSession(), searchParams, getServerOpsRepository()]);
  if (!roleCan(session, "administer")) notFound();
  const [overrides, policy] = await Promise.all([repository.listRoleCapabilityOverrides(session.organizationId), repository.getActiveWorkflowPolicy(session.organizationId)]);
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  return <MaintenanceResponsibilities model={{ organizationName: session.organizationName, overrides, policy }} notice={notice}/>;
}
