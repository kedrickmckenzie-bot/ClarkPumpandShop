import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintableReport } from "@/components/workspace/printable-report";
import { loadReportModel } from "@/lib/server/report-model";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";

export const metadata: Metadata = { title: "Printable report" };
type Query = Record<string, string | string[] | undefined>;

/** A print-ready version of one report: same scope and records as the live view, laid out for paper or PDF. */
export default async function PrintReportPage({ params, searchParams }: { params: Promise<{ reportId: string }>; searchParams: Promise<Query> }) {
  const [{ reportId }, query, session] = await Promise.all([params, searchParams, loadOperatorSession()]);
  const loaded = await loadReportModel(reportId, key => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  });
  if (!loaded) notFound();
  return <PrintableReport definition={loaded.definition} model={loaded.model} preparedFor={session.organizationName} preparedBy={session.displayName} generatedAt={new Date().toISOString()} />;
}
