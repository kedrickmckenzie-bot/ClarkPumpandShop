import { NextResponse } from "next/server";
import { loadListModel, loadProgramModel } from "@/app/app/_data/operator-loader";
import { reportCatalogEntry } from "@/lib/ops/report-catalog";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  const normalized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""')}"`;
}

export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const definition = reportCatalogEntry(reportId);
  if (!definition) return NextResponse.json({ error: "Report definition not found." }, { status: 404 });

  const incoming = new URL(request.url).searchParams;
  const query: Record<string, string> = { ...(definition.source.query ?? {}), export: "all" };
  for (const key of ["store", "region", "category", "status", "period", "from", "costFrom", "costMonth"]) {
    const value = incoming.get(key)?.trim();
    if (value) query[key] = value;
  }

  const model = definition.source.kind === "list"
    ? await loadListModel(definition.source.route, query)
    : await loadProgramModel(definition.source.route, query);
  const table = model.table;
  if (!table) return NextResponse.json({ error: "This report has no source rows in the selected scope." }, { status: 409 });

  const lines = [
    [csvCell("Report"), csvCell(definition.title)].join(","),
    [csvCell("Definition"), csvCell(definition.definition)].join(","),
    [csvCell("Scope"), csvCell(model.page.scopeLabel)].join(","),
    [csvCell("Source period"), csvCell(model.page.updatedLabel ?? "Not specified")].join(","),
    "",
    table.columns.map((column) => csvCell(column.label)).join(","),
    ...table.rows.map((row) => table.columns.map((column) => {
      const cell = row.cells.find((candidate) => candidate.key === column.key);
      return csvCell([cell?.value, cell?.secondary].filter(Boolean).join(" - "));
    }).join(",")),
  ];
  const body = `\uFEFF${lines.join("\r\n")}\r\n`;
  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${definition.id}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Exported-Record-Count": String(table.rows.length),
    },
  });
}
