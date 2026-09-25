import type { Metadata } from "next";
import { ControlTower } from "@/components/workspace/control-tower";
import { loadDashboardModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  try {
    return <ControlTower model={await loadDashboardModel()} />;
  } catch (error) {
    console.error("Overview workspace loading failed", error);
    throw error;
  }
}
