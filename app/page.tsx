import type { Metadata } from "next";
import { PlatformOverview } from "@/components/platform-overview";

export const metadata: Metadata = {
  title: "Overview",
  description: "What needs attention, what it costs, and who acts next.",
};

export default function Home() {
  return <PlatformOverview />;
}
