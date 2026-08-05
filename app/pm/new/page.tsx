import type { Metadata } from "next";
import { PmPlanCreator } from "@/components/pm-plan-creator";

export const metadata: Metadata = { title: "Create PM Plan" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const targetType = value("targetType") === "asset" ? "asset" : "system";
  return <PmPlanCreator initialStoreId={value("storeId")} initialCategoryId={value("categoryId")} initialTargetType={targetType} initialTargetId={value("targetId")} />;
}
