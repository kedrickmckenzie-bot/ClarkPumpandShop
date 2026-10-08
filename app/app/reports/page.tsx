import type { Metadata } from "next";
import { ReportingCenter } from "@/components/workspace/reporting-center";
import { reportCatalog } from "@/lib/ops/report-catalog";
import { canOpenReport } from "@/lib/ops/reports/registry";
import { loadListModel, loadOperatorSession } from "../_data/operator-loader";
import { ReportSchedules } from "@/components/workspace/report-schedules";

export const metadata: Metadata = { title: "Reports" };
type Query = Record<string, string | string[] | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  // The list model enforces who may open Reports and which older reports this role sees.
  const [model, session, query] = await Promise.all([loadListModel("reports", {}), loadOperatorSession(), searchParams]);
  const legacy = new Set(model.table.rows.map(row => row.id));
  const entries = reportCatalog.filter(entry => (entry.source.kind === "built" || legacy.has(entry.id)) && canOpenReport(entry, session.role));
  return <ReportingCenter entries={entries} schedules={<ReportSchedules notice={typeof query.saved === "string" ? query.saved : undefined} />} />;
}
