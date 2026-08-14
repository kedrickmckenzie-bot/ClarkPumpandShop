import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { ProgramView } from "@/components/ops/views";
import { loadOperatorSession, loadProgramModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Preventive maintenance" };
type Query = Record<string, string | string[] | undefined>;
export default async function PreventiveMaintenancePage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const [model, session] = await Promise.all([loadProgramModel("pm", query), loadOperatorSession()]);
  const store = Array.isArray(query.store) ? query.store[0] : query.store;
  if (roleCan(session.role, "setup_pm")) {
    model.page.primaryAction = { label: "Create PM plan", href: store ? `/app/pm/new?store=${encodeURIComponent(store)}` : "/app/pm/new" };
  }
  if (roleCan(session.role, "setup_equipment")) {
    model.page.secondaryAction = { label: "Add equipment", href: store ? `/app/equipment/new?store=${encodeURIComponent(store)}` : "/app/equipment/new" };
  }
  return <ProgramView model={model} />;
}
