import { TechnicianList } from "@/lib/server/technician-tools";
import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { ProgramView, ListView } from "@/components/ops/views";
import { loadProgramModel, loadEquipmentIssueRanking } from "../_data/operator-loader";
import { loadOperatorSession } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Equipment" };
type Query = Record<string, string | string[] | undefined>;
export default async function EquipmentPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const session=await loadOperatorSession();
  if(session.role==="technician")return <TechnicianList kind="equipment" query={Object.fromEntries(Object.entries(query).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]))}/>;
  if ((Array.isArray(query.view) ? query.view[0] : query.view) === "issues") return <ListView model={await loadEquipmentIssueRanking(query)} />;
  const model=await loadProgramModel("equipment", query);
  const store = Array.isArray(query.store) ? query.store[0] : query.store;
  if (roleCan(session, "setup_equipment")) {
    model.page.primaryAction = { label: "Add equipment", href: store ? `/app/equipment/new?store=${encodeURIComponent(store)}` : "/app/equipment/new" };
  }
  if (roleCan(session, "setup_pm")) {
    model.page.secondaryAction = { label: "Create PM plan", href: store ? `/app/pm/new?store=${encodeURIComponent(store)}` : "/app/pm/new" };
  }
  return <ProgramView model={model} compact />;
}
