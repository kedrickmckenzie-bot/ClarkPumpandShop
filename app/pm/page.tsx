import type { Metadata } from "next";
import { PmCenter } from "@/components/maintenance-platform";

export const metadata: Metadata = { title: "Preventive Maintenance" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  return <PmCenter initialStatus={value("status")} initialCategory={value("category")} initialStore={value("store")} initialRegion={value("region")} initialProvider={value("provider")} />;
}
