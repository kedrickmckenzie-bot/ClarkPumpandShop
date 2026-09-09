import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { PlanningWorkspace } from "@/components/workspace/planning-workspace";
import { PmProgramManagement } from "@/components/workspace/pm-program-management";
import { loadOperatorSession, loadPmProgramManagementModel, loadProgramModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Preventive maintenance" };
type Query = Record<string, string | string[] | undefined>;
export default async function PreventiveMaintenancePage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const [model, session, programManagement] = await Promise.all([loadProgramModel("pm", query), loadOperatorSession(), loadPmProgramManagementModel(query)]);
  const store = Array.isArray(query.store) ? query.store[0] : query.store;
  if (session.role === "executive" || session.role === "facilities") {
    model.page.primaryAction = { label: "Create company schedule", href: "/app/pm/programs/new" };
    model.page.secondaryAction = { label: "Create one store plan", href: store ? `/app/pm/new?store=${encodeURIComponent(store)}` : "/app/pm/new" };
  } else if (roleCan(session, "setup_pm")) {
    model.page.primaryAction = { label: "Create store plan", href: store ? `/app/pm/new?store=${encodeURIComponent(store)}` : "/app/pm/new" };
  }
  if (!model.page.secondaryAction && roleCan(session, "setup_equipment")) {
    model.page.secondaryAction = { label: "Add equipment", href: store ? `/app/equipment/new?store=${encodeURIComponent(store)}` : "/app/equipment/new" };
  }
  return <PlanningWorkspace kind="pm" model={model} programManagement={<PmProgramManagement model={programManagement} />} />;
}
