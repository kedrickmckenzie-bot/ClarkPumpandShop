import type { Metadata } from "next";
import { ListView } from "@/components/ops/views";
import { JobHealthSection } from "@/components/workspace/job-health";
import { loadJobHealthModel, loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Administration" };
type Query = Record<string, string | string[] | undefined>;

export default async function AdministrationPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [model, health] = await Promise.all([loadListModel("admin", await searchParams), loadJobHealthModel()]);
  return (
    <>
      <ListView model={model} />
      {health ? <details style={{ marginTop: 24 }}><summary style={{ cursor: "pointer", padding: 16, fontWeight: 600 }}>Admin diagnostics</summary><JobHealthSection model={health} /></details> : null}
    </>
  );
}
