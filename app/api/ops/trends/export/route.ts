import { loadTrendsExportModel } from "@/app/app/_data/operator-loader";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  const normalized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""').replaceAll(/\r?\n/g, " ")}"`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = Object.fromEntries(requestUrl.searchParams.entries());
  delete query.sourcePage;

  const model = await loadTrendsExportModel(query);
  const allRows = model.exportRows ?? [];

  const metadata = [
    ["Report", "Trend source export"],
    ["Measure", model.metricLabel],
    ["Definition", model.metricDefinition],
    ["Scope", model.page.scopeLabel],
    ["Current period", model.currentPeriodLabel],
    ["Comparison", model.comparisonPeriodLabel ? `${model.comparisonLabel} · ${model.comparisonPeriodLabel}` : "Not selected"],
    ["Exported source view", model.sourcePeriodLabel],
    ["Source evidence measure", model.sourceMeasureLabel ?? model.metricLabel],
    ["Canonical analysis query", model.canonicalQuery],
    ["Peer methodology", model.benchmark.methodology],
    ["Vendor accountability methodology", model.vendorAccountability.methodology],
    ["Record count", String(allRows.length)],
  ];
  const columns = [
    "source_id", "source_kind", "record_label", "detail", "source_date", "store_local_date", "period_key", "time_basis",
    "raw_value", "amount_minor", "currency", "units", "store_id", "store_number", "work_order_id", "invoice_id", "visit_id",
    "pm_occurrence_id", "category_keys", "asset_ids", "component_names", "vendor_id", "provider_attribution",
    "provider_attribution_rule", "cohort_id", "reference_start", "reference_end", "uncapped_input", "capped_input", "weight",
    "exposure_factor", "coverage_status", "contributing_source_ids", "source_link",
  ];
  const data = allRows.map((row) => [
    row.sourceId, row.sourceKind, row.recordLabel, row.detail, row.sourceDate, row.localDate, row.periodKey, row.timeBasis,
    String(row.rawValue), row.amountMinor === undefined ? "" : String(row.amountMinor), row.currency ?? "", row.units,
    row.storeId, row.storeNumber ?? "", row.workOrderId ?? "", row.invoiceId ?? "", row.visitId ?? "", row.pmOccurrenceId ?? "",
    row.categoryKeys.join("|"), row.assetIds.join("|"), row.componentNames.join("|"), row.vendorId ?? "",
    row.providerAttribution ?? "", row.providerAttributionLabel ?? "", row.cohortId ?? "", row.referenceStart ?? "",
    row.referenceEnd ?? "", row.uncappedInput === undefined ? "" : String(row.uncappedInput),
    row.cappedInput === undefined ? "" : String(row.cappedInput), row.weight === undefined ? "" : String(row.weight),
    row.exposureFactor === undefined ? "" : String(row.exposureFactor), row.coverageStatus ?? "",
    row.contributingSourceIds.join("|"), new URL(row.sourcePath, requestUrl.origin).toString(),
  ]);
  const csv = `\uFEFF${[
    ...metadata.map((row) => row.map(csvCell).join(",")),
    "",
    columns.map(csvCell).join(","),
    ...data.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n")}`;
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="trend-source-${model.metricId}-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
