import type { Metadata } from "next";
import { CreateRequestForm } from "@/components/ops/forms";
import { loadCreateRequestModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewRequestPage() {
  return <CreateRequestForm model={await loadCreateRequestModel()} />;
}
