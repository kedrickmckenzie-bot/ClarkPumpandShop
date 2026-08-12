import type { Metadata } from "next";
import { DashboardView } from "@/components/ops/views";
import { loadDashboardModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  return <DashboardView model={await loadDashboardModel()} />;
}
