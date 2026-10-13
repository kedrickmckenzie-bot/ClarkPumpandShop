import type { Metadata } from "next";
import RefrigerantCompliance from "@/components/workspace/refrigerant-compliance";

export const metadata: Metadata = { title: "Refrigerant compliance" };

export default async function RefrigerantCompliancePage({ searchParams }: { searchParams: Promise<{ view?: string; offset?: string }> }) {
  return <RefrigerantCompliance searchParams={searchParams} />;
}
