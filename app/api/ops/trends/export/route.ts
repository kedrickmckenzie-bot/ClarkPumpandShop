import { loadTrendsModel } from "@/app/app/_data/operator-loader";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  const normalized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""').replaceAll(/\r?\n/g, " ")}"`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = Object.fromEntries(requestUrl.searchParams.entries());
  delete query.sourcePage;

  const firstPage = await loadTrendsModel({ ...query, sourcePage: "1" });
  const allRows = [...firstPage.sourceTable.rows];
  for (let page = 2; page <= firstPage.sourcePagination.totalPages; page += 1) {
    const nextPage = await loadTrendsModel({ ...query, sourcePage: String(page) });
    allRows.push(...nextPage.sourceTable.rows);
  }

  const metadata = [
    ["Report", "Trend source export"],
    ["Measure", firstPage.metricLabel],
    ["Definition", firstPage.metricDefinition],
    ["Scope", firstPage.page.scopeLabel],
    ["Current period", firstPage.currentPeriodLabel],
    ["Comparison", firstPage.comparisonPeriodLabel ? `${firstPage.comparisonLabel} · ${firstPage.comparisonPeriodLabel}` : "Not selected"],
    ["Exported source view", firstPage.sourcePeriodLabel],
    ["Record count", String(allRows.length)],
  ];
  const columns = [...firstPage.sourceTable.columns.map((column) => column.label), "Record link"];
  const data = allRows.map((row) => [
    ...row.cells.map((cell) => cell.secondary ? `${cell.value} · ${cell.secondary}` : cell.value),
    new URL(row.href, requestUrl.origin).toString(),
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
      "Content-Disposition": `attachment; filename="trend-source-${firstPage.metricId}-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
