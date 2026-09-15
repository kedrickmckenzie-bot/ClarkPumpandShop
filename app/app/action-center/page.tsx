import type { Metadata } from "next";
import { ListSurface } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";
import Link from "next/link";

export const metadata: Metadata = { title: "Action center" };
type Query = Record<string, string | string[] | undefined>;

export default async function ActionCenterPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  let model;
  try { model=await loadListModel("action-center", params); }
  catch(error) { if(!(error instanceof RangeError)) throw error; return <div><h1>Review queue</h1><p>{error.message}</p><Link href="/app/action-center">Open review queue</Link></div>; }
  return <ListSurface model={model} surface="action-center" searchParams={params} />;
}
