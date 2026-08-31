import type { Metadata } from "next";
import { TrendsWorkspace } from "@/components/workspace/trends-workspace";
import { SavedViewsBar } from "@/components/workspace/saved-views";
import { loadOperatorSession, loadSavedViewsModel, loadTrendsModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Trends" };

type Query = Record<string, string | string[] | undefined>;

export default async function TrendsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const [model, savedViews, session] = await Promise.all([
    loadTrendsModel(params),
    loadSavedViewsModel("trends"),
    loadOperatorSession(),
  ]);
  return (
    <>
      {session.demoEdition === "complete" ? <SavedViewsBar model={{ surface: "trends", currentQuery: model.canonicalQuery, views: savedViews }} /> : null}
      <TrendsWorkspace model={model} />
    </>
  );
}
