import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VendorScorecardPage } from "@/components/workspace/vendor-scorecard-page";
import { getServerOpsRepository, getServerOpsReportingAsOf } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "../../_data/operator-loader";
import { buildVendorScorecardPage, canViewVendorScorecards } from "../../_data/vendor-scorecard-presenter";

export const metadata: Metadata = { title: "Vendor scorecards" };

export default async function VendorScorecardsRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await loadOperatorSession();
  if (!canViewVendorScorecards(session)) notFound();
  const model = await buildVendorScorecardPage(await getServerOpsRepository(), session, await searchParams, getServerOpsReportingAsOf());
  return <VendorScorecardPage model={model} />;
}
