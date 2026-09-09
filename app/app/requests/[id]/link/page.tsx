import type { Metadata } from "next";
import { RequestWorkLinker } from "@/components/ops/request-work-linker";
import { loadRequestWorkLinkModel } from "../../../_data/operator-loader";

export const metadata: Metadata = { title: "Link request to work" };

export default async function RequestWorkLinkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string | string[]; page?: string | string[]; returnTo?: string | string[] }> }) {
  const { id } = await params;
  return <RequestWorkLinker model={await loadRequestWorkLinkModel(id, await searchParams)} />;
}
