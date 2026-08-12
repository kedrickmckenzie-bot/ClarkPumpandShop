import type { Metadata } from "next";
import { CreateStoreForm } from "@/components/ops/forms";
import { loadCreateStoreModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Add store" };

export default async function NewStorePage() {
  return <CreateStoreForm model={await loadCreateStoreModel()} />;
}
