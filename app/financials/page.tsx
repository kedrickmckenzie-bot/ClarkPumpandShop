import type { Metadata } from "next";
import {
  FinancialSuite,
  type FinancialView,
} from "@/components/financial-platform";

export const metadata: Metadata = { title: "Spending & bills" };

const views: FinancialView[] = [
  "overview",
  "budgets",
  "approvals",
  "purchase-orders",
  "invoices",
  "payments",
  "accruals",
  "dimensions",
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requested = typeof query.view === "string" ? query.view : "overview";
  const initialView = views.includes(requested as FinancialView)
    ? (requested as FinancialView)
    : "overview";
  return <FinancialSuite initialView={initialView} />;
}
