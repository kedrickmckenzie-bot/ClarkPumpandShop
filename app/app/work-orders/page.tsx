import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListSurface } from "@/components/ops/views";
import { roleCan } from "@/components/ops/role-policy";
import { SavedViewsBar } from "@/components/workspace/saved-views";
import { loadApprovedWorkPortfolioModel, loadListModel, loadOperatorSession, loadSavedViewsModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Work orders" };
type Query = Record<string, string | string[] | undefined>;

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  if (first(params.basis) === "invoiced") {
    const target = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => first(value) ? [[key, first(value)!]] : []));
    if (target.has("costFrom")) target.set("from", target.get("costFrom")!);
    if (target.has("costTo")) target.set("to", target.get("costTo")!);
    for (const key of ["hasCost", "costFrom", "costTo", "selected"]) target.delete(key);
    redirect(`/app/invoices?${target}`);
  }
  // The ordinary list and held-work portfolio stay on bounded repository reads.
  // Load the richer legacy matching projection only when a user explicitly asks
  // for confirmed-opportunity or review-window analysis.
  const needsSpecializedOpportunityProjection = first(params.visitPlan) === "ready"
    && Boolean(first(params.opportunity) || first(params.reviewWindow) || first(params.matchStore));
  const [model, approvedWork, savedViews, session] = await Promise.all([
    loadListModel("work-orders", params),
    needsSpecializedOpportunityProjection ? loadApprovedWorkPortfolioModel(params) : Promise.resolve(undefined),
    loadSavedViewsModel("work-orders"),
    loadOperatorSession(),
  ]);
  const currentQuery = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]])),
  ).toString();

  return (
    <>
      {session.demoEdition === "complete" ? <SavedViewsBar model={{ surface: "work-orders", currentQuery, views: savedViews }} collapsed={model.rowNavigation === "record"} /> : null}
      <ListSurface
        model={model}
        approvedWork={approvedWork}
        surface="work-orders"
        searchParams={params}
        canManageWorkflowTasks={roleCan(session, "manage_workflow_tasks")}
      />
    </>
  );
}
