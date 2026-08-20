import type { Metadata } from "next";
import { ServiceRunListWorkspace } from "@/components/ops/service-run-workspace";
import { loadServiceRunWorkspace } from "../_data/service-run-loader";

export const metadata: Metadata = { title: "Service Run planner" };
export default async function ServiceRunsPage() {
  const { fixture, runs } = await loadServiceRunWorkspace();
  return <ServiceRunListWorkspace fixture={fixture} runs={runs} />;
}
