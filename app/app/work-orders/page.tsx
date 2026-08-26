import type { Metadata } from "next";
import { ListSurface } from "@/components/ops/views";
import { SavedViewsBar } from "@/components/workspace/saved-views";
import { loadListModel, loadOperatorSession, loadSavedViewsModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Work orders" };
type Query = Record<string, string | string[] | undefined>;

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const [model, savedViews, session] = await Promise.all([
    loadListModel("work-orders", params),
    loadSavedViewsModel("work-orders"),
    loadOperatorSession(),
  ]);
  const currentQuery = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]])),
  ).toString();

  return (
    <>
      {session.demoEdition === "complete" ? <SavedViewsBar model={{ surface: "work-orders", currentQuery, views: savedViews }} /> : null}
      <ListSurface model={model} surface="work-orders" searchParams={params} />
    </>
  );
}
