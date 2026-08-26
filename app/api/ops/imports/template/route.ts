import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { importTemplate, type ImportEntity } from "@/lib/ops/import-preview";
import { OpsDomainError } from "@/lib/ops/commands";
const entities = new Set<ImportEntity>(["stores", "vendors", "equipment"]);
export async function GET(request: Request) { try { await getOpsRequestContext(["facilities"]); const entity = new URL(request.url).searchParams.get("entity") as ImportEntity; if (!entities.has(entity)) throw new OpsDomainError("VALIDATION", "Choose a supported import template."); return new Response(importTemplate(entity), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${entity}-import-template.csv"` } }); } catch (error) { return opsApiError(error); } }
