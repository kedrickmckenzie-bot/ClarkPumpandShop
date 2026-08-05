import type { Metadata } from "next";
import { MaintenanceDashboard } from "@/components/maintenance-dashboard";

export const metadata: Metadata = {
  title: "Maintenance Home",
  description: "Dispatch, schedule, technician work, PM and parts control across the maintenance portfolio.",
};

export default function Home() {
  return <MaintenanceDashboard />;
}
