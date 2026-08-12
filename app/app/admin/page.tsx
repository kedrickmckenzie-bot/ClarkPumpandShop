import type { Metadata } from "next";
import { ListView } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Administration" };
type Query = Record<string, string | string[] | undefined>;

export default async function AdministrationPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <ListView model={await loadListModel("admin", await searchParams)} />;
}
