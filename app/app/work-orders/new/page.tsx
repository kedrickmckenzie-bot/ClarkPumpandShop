import type { Metadata } from "next";
import { CreateWorkOrderForm } from "@/components/ops/forms";
import { loadCreateWorkOrderModel, loadOperatorSession } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Create work order" };

type Query = Record<string, string | string[] | undefined>;

export default async function NewWorkOrderPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const componentId = Array.isArray(query.component) ? query.component[0] : query.component;
  const [model, session] = await Promise.all([
    loadCreateWorkOrderModel(query),
    loadOperatorSession(),
  ]);
  if (session.demoEdition === "accountability") {
    model.page.description = "Create the customer work-order number the vendor will receive and select during check-in.";
  }
  return <CreateWorkOrderForm model={model} componentId={componentId} edition={session.demoEdition} />;
}
