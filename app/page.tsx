import type { Metadata } from "next";
import { PlatformOverview } from "@/components/platform-overview";

export const metadata: Metadata = {
  title: "Portfolio Overview",
  description: "Maintenance cost, reporting, and accountability across the operating portfolio.",
};

export default function Home() {
  return <PlatformOverview />;
}
