import type { Metadata } from "next";
import { TrendsWorkspace } from "@/components/workspace/trends-workspace";
import { SavedViewsBar } from "@/components/workspace/saved-views";
import InHouseTrends from "@/components/workspace/in-house-trends";
import { loadOperatorSession, loadTrendsPageData } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Trends" };

type Query = Record<string, string | string[] | undefined>;

export default async function TrendsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  if (params.view === "in_house") {
    const session = await loadOperatorSession();
    if (session.role !== "store_manager" && session.role !== "technician") return <InHouseTrends session={session} query={params} />;
  }
  const { model, savedViews, session } = await loadTrendsPageData(params);
  return <TrendsWorkspace model={model} savedViews={session.demoEdition === "complete" ? <SavedViewsBar scenarios={model.activeView === "planning"} model={{ surface: "trends", currentQuery: model.canonicalQuery, views: model.activeView === "planning" ? savedViews.filter((view) => new URLSearchParams(view.queryString).get("view") === "planning") : savedViews }} /> : null} />;
}
