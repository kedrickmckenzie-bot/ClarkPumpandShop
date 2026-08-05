import type { Metadata } from "next";
import { PlatformOverview } from "@/components/platform-overview";

export const metadata: Metadata = {
  title: "Maintenance Spending Intelligence",
  description:
    "See maintenance spending, cost outliers, lifecycle signals, and the exact work records behind every number.",
};

export default function Home() {
  return <PlatformOverview />;
}
