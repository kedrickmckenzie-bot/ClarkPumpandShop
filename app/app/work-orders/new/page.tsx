import type { Metadata } from "next";
import { CreateWorkOrderForm } from "@/components/ops/forms";
import { loadCreateWorkOrderModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Create work order" };

type Query = Record<string, string | string[] | undefined>;

export default async function NewWorkOrderPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const componentId = Array.isArray(query.component) ? query.component[0] : query.component;
  return <CreateWorkOrderForm model={await loadCreateWorkOrderModel(query)} componentId={componentId} />;
}
