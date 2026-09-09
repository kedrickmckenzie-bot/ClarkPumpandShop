import type { Metadata } from "next";
import { CreateRequestForm } from "@/components/ops/forms";
import { loadCreateRequestModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Report an issue" };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CreateRequestForm model={await loadCreateRequestModel(await searchParams)} />;
}
