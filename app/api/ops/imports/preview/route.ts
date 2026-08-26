import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { previewImport, type ImportEntity } from "@/lib/ops/import-preview";
import { OpsDomainError } from "@/lib/ops/commands";
const entities = new Set<ImportEntity>(["stores", "vendors", "equipment"]);
export async function POST(request: Request) { try { const context = await getOpsRequestContext(["facilities"]); const form = await request.formData(); const entity = String(form.get("entity") ?? "") as ImportEntity; const file = form.get("file"); if (!entities.has(entity) || !(file instanceof File)) throw new OpsDomainError("VALIDATION", "Choose an import type and CSV file."); const snapshot = await getServerOpsFixtureSnapshot(context.session.organizationId); return Response.json(previewImport(entity, await file.text(), snapshot, context.session.organizationId)); } catch (error) { if (error instanceof Error && !(error instanceof OpsDomainError)) return Response.json({ error: error.message }, { status: 422 }); return opsApiError(error); } }
