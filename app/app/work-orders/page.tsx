import type { Metadata } from "next";
import { ListView } from "@/components/ops/views";
import { SavedViewsBar } from "@/components/workspace/saved-views";
import { loadListModel, loadSavedViewsModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Work orders" };
type Query = Record<string, string | string[] | undefined>;

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const [model, savedViews] = await Promise.all([loadListModel("work-orders", params), loadSavedViewsModel("work-orders")]);
  const currentQuery = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]])),
  ).toString();

  return (
    <>
      <SavedViewsBar model={{ surface: "work-orders", currentQuery, views: savedViews }} />
      <ListView model={model} />
    </>
  );
}
