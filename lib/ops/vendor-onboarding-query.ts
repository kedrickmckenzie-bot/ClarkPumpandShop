import { OpsDomainError } from "./errors";
import type { OpsFixture } from "./types";
import type { OpsSqlDriver } from "./sql-driver";
export interface VendorOnboardingSelection {
    regions: string[];
    stores: string[];
    specialties: {
        canonicalKey: string;
        displayName: string;
    }[];
}
function bounded(values: string[]) { if (values.length > 100)
    throw new OpsDomainError("VALIDATION", "Choose at most 100 values."); return [...new Set(values)]; }
export function vendorOnboardingFromFixture(f: OpsFixture, org: string, scopeIds: string[], keys: string[]): VendorOnboardingSelection {
    const ids = bounded(scopeIds), trades = bounded(keys), specialties = new Map<string, string>();
    for (const s of f.vendorSpecialties.filter(s => s.organizationId === org && trades.includes(s.canonicalKey)).sort((a, b) => a.displayName < b.displayName ? -1 : a.displayName > b.displayName ? 1 : 0))
        if (!specialties.has(s.canonicalKey))
            specialties.set(s.canonicalKey, s.displayName);
    return { regions: f.regions.filter(r => r.organizationId === org && ids.includes(r.id)).map(r => r.id).sort(), stores: f.stores.filter(s => s.organizationId === org && ids.includes(s.id)).map(s => s.id).sort(), specialties: [...specialties].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([canonicalKey, displayName]) => ({ canonicalKey, displayName })) };
}
export async function queryVendorOnboarding(driver: OpsSqlDriver, org: string, scopeIds: string[], keys: string[]): Promise<VendorOnboardingSelection> {
    const ids = bounded(scopeIds), trades = bounded(keys), params: unknown[] = [], queries: string[] = [], binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
    for (const [kind, table, values] of [["region", "ops_regions", ids], ["store", "ops_stores", ids], ["specialty", "ops_vendor_specialties", trades]] as const)
        if (values.length) {
            params.push(org, ...values);
            queries.push(kind === "specialty" ? `SELECT 'specialty' AS kind,canonical_key AS id,MIN(display_name ${binary}) AS label FROM ${table} WHERE organization_id=? AND canonical_key IN (${values.map(() => "?").join(",")}) GROUP BY canonical_key` : `SELECT '${kind}' AS kind,id,id AS label FROM ${table} WHERE organization_id=? AND id IN (${values.map(() => "?").join(",")})`);
        }
    if (!queries.length)
        return { regions: [], stores: [], specialties: [] };
    const result = await driver.query({ sql: `SELECT * FROM (${queries.join(" UNION ALL ")}) choices ORDER BY kind,id ${binary}`, params });
    return { regions: result.rows.filter(r => r.kind === "region").map(r => String(r.id)), stores: result.rows.filter(r => r.kind === "store").map(r => String(r.id)), specialties: result.rows.filter(r => r.kind === "specialty").map(r => ({ canonicalKey: String(r.id), displayName: String(r.label) })) };
}
export interface OnboardingConfiguration {
    regions: OpsFixture["regions"];
    vendorSpecialties: Array<Pick<OpsFixture["vendorSpecialties"][number], "organizationId" | "canonicalKey" | "displayName">>;
}
