import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportDocument } from "@/components/workspace/report-document";
import { loadReportDoc } from "@/lib/server/report-model";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";

export const metadata: Metadata = { title: "Scheduled report" };

/**
 * A saved scheduled send. It is rebuilt from the records with the period fixed to the send date,
 * and shows only the stores the person opening it may see.
 */
export default async function ReportRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const [{ runId }, session] = await Promise.all([params, loadOperatorSession()]);
  const repository = await getServerOpsRepository();
  const run = await repository.getReportRun(session.organizationId, decodeURIComponent(runId));
  if (!run) notFound();
  let options: Record<string, string> = {};
  try { options = JSON.parse(run.optionsJson) as Record<string, string>; } catch { /* defaults */ }
  const { entry, doc, choices, today, zone } = await loadReportDoc(run.reportId, key => options[key], run.runAt);
  const sent = cachedDateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(run.runAt));
  return <ReportDocument doc={doc} choices={choices} today={today} preparedBy="Scheduled report" generatedAt={run.runAt} timeZone={zone} built={entry.source.kind === "built"}
    run={{ label: `Scheduled report for ${run.periodLabel}, sent ${sent}. Numbers come from today's records, so later corrections show up here.` }} />;
}
