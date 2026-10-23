import type { Metadata } from "next";
import { ListSurface } from "@/components/ops/views";
import { loadListModel, loadOperatorSession } from "../_data/operator-loader";
import Link from "next/link";
import { roleCan } from "@/components/ops/role-policy";
import { ReviewDecide } from "@/components/workspace/review-decide";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { loadReviewDecide } from "@/lib/server/review-decide";

export const metadata: Metadata = { title: "Review" };
type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function ActionCenterPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  // Managers land on the three decision sections; any filter or search opens the full queue.
  const filtered = ["lane", "q", "type", "priority", "stage", "page", "cursor"].some(key => first(params[key]));
  if (!filtered) {
    const session = await loadOperatorSession();
    if (["facilities", "regional", "executive", "store_manager"].includes(session.role)) {
      const asOf = new Date().toISOString(), store = first(params.store);
      const decide = await loadReviewDecide(await getServerOpsRepository(), session, asOf, store);
      const view = first(params.view) === "stores" ? "stores" : "mine";
      return <ReviewDecide {...decide} view={view} showOnsite={first(params.onsite) === "1"} showAllHelp={first(params.helpAll) === "1"} storeView={session.role === "store_manager"} asOf={asOf} canRoute={roleCan(session, "assign_internal_work")} storeQuery={store}/>;
    }
  }
  let model;
  try { model=await loadListModel("action-center", params); }
  catch(error) { if(!(error instanceof RangeError)) throw error; return <div><h1>Review</h1><p>{error.message}</p><Link href="/app/action-center">Open Review</Link></div>; }
  return <ListSurface model={model} surface="action-center" searchParams={params} />;
}
