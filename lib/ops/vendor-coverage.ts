import { OpsDomainError, type OpsCommandServices } from "./commands";
import { communicationAudit, evidenceDigest, evidenceFence, insertRecord } from "./email-intake";
import type { ActorContext, VendorCoverage } from "./types";

export function coverageVersion(rows: VendorCoverage[]) {
  return rows.map(row => row.id).sort().join(",");
}

export async function updateVendorCoverage(svc: OpsCommandServices, input: {
  organizationId: string; vendorId: string; scopeIds: string[]; expectedVersion: string; actor: ActorContext;
}) {
  const { repository } = svc;
  const { organizationId: org, vendorId, actor } = input;
  if (actor.organizationId !== org) throw new OpsDomainError("FORBIDDEN", "Organization access required.");
  if (!await repository.getVendor(org, vendorId)) throw new OpsDomainError("NOT_FOUND", "Vendor not found.");
  const scopeIds = [...new Set(input.scopeIds)];
  if (!scopeIds.length || scopeIds.length > 100 || scopeIds.some(id => !id || id.length > 200))
    throw new OpsDomainError("VALIDATION", "Choose at least one coverage area, up to 100.");
  const selection = await repository.readVendorOnboardingSelection(org, scopeIds, []);
  const before = await repository.listVendorCoverage(org, vendorId);
  if (coverageVersion(before) !== input.expectedVersion) throw new OpsDomainError("CONFLICT", "Coverage changed. Refresh before saving.");
  const after = scopeIds.map(scopeId => {
    const scopeKind = scopeId === org ? "organization" : selection.regions.includes(scopeId) ? "region" : selection.stores.includes(scopeId) ? "store" : undefined;
    if (!scopeKind) throw new OpsDomainError("VALIDATION", "Choose coverage from your organization.");
    return { id: `coverage-${crypto.randomUUID()}`, organizationId: org, vendorId, scopeKind, scopeId,
      preferredRank: before.find(row => row.scopeKind === scopeKind && row.scopeId === scopeId)?.preferredRank } satisfies VendorCoverage;
  });
  if (scopeIds.includes(org) && scopeIds.length > 1) throw new OpsDomainError("VALIDATION", "Choose all stores or specific coverage areas.");
  const now = svc.clock?.now() ?? new Date().toISOString();
  const fenceKey = `vendor-coverage:${vendorId}:${await evidenceDigest(input.expectedVersion)}`;
  try {
    await repository.atomicWrite([
      evidenceFence(org, fenceKey, vendorId, now),
      { sql: "DELETE FROM ops_vendor_coverage WHERE organization_id = ? AND vendor_id = ?", params: [org, vendorId] },
      ...after.map(row => insertRecord("ops_vendor_coverage", { id: row.id, organization_id: org, vendor_id: vendorId, scope_kind: row.scopeKind, scope_id: row.scopeId, preferred_rank: row.preferredRank })),
      communicationAudit(org, vendorId, "vendor.coverage_updated", actor, now, { before, after }, "vendor"),
    ]);
  } catch (error) {
    if (await repository.getIdempotencyKey(org, fenceKey)) throw new OpsDomainError("CONFLICT", "Coverage changed. Refresh before saving.");
    throw error;
  }
}
