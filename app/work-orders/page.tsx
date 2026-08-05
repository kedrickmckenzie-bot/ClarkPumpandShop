import type { Metadata } from "next";
import { WorkOrderDirectory } from "@/components/maintenance-platform";

export const metadata: Metadata = { title: "Work Orders" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const queue = value("queue");
  const initialView = value("view") || (["overdue", "missing-action"].includes(queue) ? queue : "");
  return <WorkOrderDirectory initialStatus={value("status")} initialAssignment={value("assignment")} initialPriority={value("priority")} initialCategory={value("category")} initialProvider={value("providerId")} initialStore={value("store")} initialSystem={value("system")} initialAsset={value("asset")} initialComponent={value("component")} initialAcceptance={value("acceptance")} initialView={initialView} />;
}
