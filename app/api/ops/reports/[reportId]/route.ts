import { opsApiError } from "@/lib/server/ops-request-context";
import { NextResponse } from "next/server";
import { loadReportModel } from "@/lib/server/report-model";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  const normalized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""')}"`;
}

export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
  const { reportId } = await params;
  const incoming = new URL(request.url).searchParams;
  const loaded = await loadReportModel(reportId, key => incoming.get(key));
  if (!loaded) return NextResponse.json({ error: "Report definition not found." }, { status: 404 });
  const { definition, model } = loaded;
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
  } catch (error) { return opsApiError(error); }
}
