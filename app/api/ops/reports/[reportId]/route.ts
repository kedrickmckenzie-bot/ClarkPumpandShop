import { opsApiError } from "@/lib/server/ops-request-context";
import { NextResponse } from "next/server";
import { loadReportDoc } from "@/lib/server/report-model";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  const normalized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${normalized.replaceAll('"', '""')}"`;
}

/** CSV of a report's records, with the same scope, period and options as the report on screen. */
export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params;
    const incoming = new URL(request.url).searchParams;
    // A CSV always carries every record.
    const { doc } = await loadReportDoc(reportId, key => key === "detail" ? "all" : incoming.get(key));
    const section = doc.sections.find(s => s.id === doc.recordsSectionId && s.kind === "table") ?? doc.sections.find(s => s.kind === "table");
    if (!section || section.kind !== "table") return NextResponse.json({ error: "This report has no records to export." }, { status: 409 });
    const lines = [
      [csvCell("Report"), csvCell(doc.title)].join(","),
      [csvCell("Period"), csvCell(doc.periodLabel ?? doc.period?.label ?? "")].join(","),
      [csvCell("Covers"), csvCell(doc.scopeLabel)].join(","),
      [csvCell("How this is counted"), csvCell(doc.howCounted.join(" "))].join(","),
      "",
      section.columns.map(c => csvCell(c.label)).join(","),
      ...section.rows.map(row => section.columns.map(c => csvCell([row.cells[c.key], row.sub?.[c.key]].filter(Boolean).join(" - "))).join(",")),
    ];
    return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${doc.reportId}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Exported-Record-Count": String(section.rows.length),
      },
    });
  } catch (error) { return opsApiError(error); }
}
