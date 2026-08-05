import type { Metadata } from "next";
import { ReportingSuite } from "@/components/reporting-platform";

export const metadata: Metadata = { title: "Reports", description: "Explainable reporting with complete record drill-through." };
export default async function Page({ searchParams }: { searchParams: Promise<{ report?: string; region?: string; category?: string }> }) {
  const { report, region, category } = await searchParams;
  return <ReportingSuite initialReport={report} initialRegion={region} initialCategory={category} />;
}
