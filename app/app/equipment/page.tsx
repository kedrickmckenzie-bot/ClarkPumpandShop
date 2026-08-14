import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { ProgramView } from "@/components/ops/views";
import { loadProgramModel } from "../_data/operator-loader";
import { loadOperatorSession } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Equipment" };
type Query = Record<string, string | string[] | undefined>;
export default async function EquipmentPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const [model, session] = await Promise.all([loadProgramModel("equipment", query), loadOperatorSession()]);
  const store = Array.isArray(query.store) ? query.store[0] : query.store;
  if (roleCan(session.role, "setup_equipment")) {
    model.page.primaryAction = { label: "Add equipment", href: store ? `/app/equipment/new?store=${encodeURIComponent(store)}` : "/app/equipment/new" };
  }
  if (roleCan(session.role, "setup_pm")) {
    model.page.secondaryAction = { label: "Create PM plan", href: store ? `/app/pm/new?store=${encodeURIComponent(store)}` : "/app/pm/new" };
  }
  return <ProgramView model={model} />;
}
