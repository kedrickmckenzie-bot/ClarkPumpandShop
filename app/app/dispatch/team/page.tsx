import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamScorecardPage } from "@/components/workspace/team-scorecard-page";
import { getServerOpsRepository, getServerOpsReportingAsOf } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "../../_data/operator-loader";
import { buildTeamScorecardPage, canViewTeamScorecard } from "../../_data/team-scorecard-presenter";

export const metadata: Metadata = { title: "Team scorecard" };

export default async function TeamScorecardRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await loadOperatorSession();
  if (!canViewTeamScorecard(session)) notFound();
  const model = await buildTeamScorecardPage(await getServerOpsRepository(), session, await searchParams, getServerOpsReportingAsOf());
  return <TeamScorecardPage model={model} />;
}
