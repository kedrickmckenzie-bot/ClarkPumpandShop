import type { Metadata } from "next";
import { TrendsWorkspace } from "@/components/workspace/trends-workspace";
import { SavedViewsBar } from "@/components/workspace/saved-views";
import InHouseTrends from "@/components/workspace/in-house-trends";
import VendorTrends from "@/components/workspace/vendor-trends";
import { loadOperatorSession, loadTrendsPageData, loadTrendsDashboard } from "../_data/operator-loader";
import { TrendsDashboard } from "@/components/workspace/trends-dashboard";
import { buildTrendsDashboard } from "../_data/trends-dashboard";

export const metadata: Metadata = { title: "Trends" };

type Query = Record<string, string | string[] | undefined>;

export default async function TrendsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  if (params.view === "in_house") {
    const session = await loadOperatorSession();
    if (session.role !== "store_manager" && session.role !== "technician") return <InHouseTrends session={session} query={params} />;
  }
  if (params.view === "vendors") {
    const session = await loadOperatorSession();
    if (session.role !== "store_manager" && session.role !== "technician") return <VendorTrends session={session} query={params} />;
  }
  // The overview is the trends dashboard; the other views keep their own pages.
  if (!params.view || params.view === "overview") return <TrendsDashboard model={await loadTrendsDashboard(buildTrendsDashboard, params)} />;
  const { model, savedViews, session } = await loadTrendsPageData(params);
  return <TrendsWorkspace model={model} savedViews={session.demoEdition === "complete" ? <SavedViewsBar scenarios={model.activeView === "planning"} model={{ surface: "trends", currentQuery: model.canonicalQuery, views: model.activeView === "planning" ? savedViews.filter((view) => new URLSearchParams(view.queryString).get("view") === "planning") : savedViews }} /> : null} />;
}
