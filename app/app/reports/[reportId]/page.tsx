import type { Metadata } from "next";
import { ReportDocument } from "@/components/workspace/report-document";
import { loadReportDoc } from "@/lib/server/report-model";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";

export const metadata: Metadata = { title: "Report" };
type Query = Record<string, string | string[] | undefined>;

/** One report: choose the period and stores, read it on screen, print or save it as PDF. */
export default async function ReportPage({ params, searchParams }: { params: Promise<{ reportId: string }>; searchParams: Promise<Query> }) {
  const [{ reportId }, query, session] = await Promise.all([params, searchParams, loadOperatorSession()]);
  const now = new Date().toISOString();
  const { entry, doc, choices, today, zone } = await loadReportDoc(reportId, key => query[key], now);
  return <ReportDocument doc={doc} choices={choices} today={today} preparedBy={session.displayName} generatedAt={now} timeZone={zone} built={entry.source.kind === "built"} />;
}
