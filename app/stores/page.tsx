import type { Metadata } from "next";
import { StoreDirectory } from "@/components/store-platform";

export const metadata: Metadata = { title: "Stores", description: "Search and compare every store in the operating portfolio." };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const region = typeof query.region === "string" ? query.region : "";
  return <StoreDirectory initialRegion={region} />;
}
