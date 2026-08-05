import type { Metadata } from "next";
import { MaintenanceCenter } from "@/components/maintenance-platform";

export const metadata: Metadata = { title: "Maintenance" };

export default function Page() {
  return <MaintenanceCenter />;
}
