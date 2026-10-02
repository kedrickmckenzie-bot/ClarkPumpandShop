import { OpsDomainError, type OpsCommandServices } from "./commands";
import { communicationAudit, insertRecord } from "./email-intake";
import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import type { ActorContext, OpsFixture } from "./types";

export function vendorSearchTerm(value:string){return value.trim().toLowerCase().replace(/card readers?/g,"payment terminal").replace(/gas pumps?/g,"dispenser").replace(/^gas$/,"fuel").replace(/parking lot potholes?|potholes?/g,"parking lot").replace(/slush(?:ie|y)? machine|slurpee machine|frozen drink machine/g,"refrigeration");}

export interface StoreVendorPreference {
  id: string; organizationId: string; storeId: string; vendorId: string;
  tradeKeysJson: string; version: number; createdAt: string;
}
export interface StoreVendorRow {
  id: string; name: string; email: string; phone?: string; covered: boolean;
  coverage: string[]; specialties: Array<{ key: string; label: string }>;
  preferenceKeys: string[]; version: number;
}
export interface StoreVendorQuery { search?: string; offset?: number; }
export interface StoreVendorPage { items: StoreVendorRow[]; total: number; /** Counts across every match, not just this page. */ preferredTotal: number; coveredTotal: number; }
export function preferenceKeys(row: StoreVendorPreference | null | undefined): string[] {
  return row ? JSON.parse(row.tradeKeysJson) as string[] : [];
}
export function latestStorePreference(f: OpsFixture, org: string, storeId: string, vendorId: string) {
  return (f.storeVendorPreferences ?? []).filter(r => r.organizationId === org && r.storeId === storeId && r.vendorId === vendorId).sort((a,b) => b.version-a.version)[0] ?? null;
}
export function storeVendorsFromFixture(f: OpsFixture, scope: OrganizationScope, storeId: string, query: StoreVendorQuery): StoreVendorPage {
  const store = f.stores.find(s => s.organizationId === scope.organizationId && s.id === storeId && (scope.storeIds === undefined || scope.storeIds.includes(s.id)) && (scope.regionIds === undefined || scope.regionIds.includes(s.regionId ?? "")));
  if (!store) return {items: [], total: 0, preferredTotal: 0, coveredTotal: 0};
  const rows = f.vendors.filter(v => v.organizationId === scope.organizationId).flatMap(v => {
    const coverage = f.vendorCoverage.filter(c => c.organizationId === scope.organizationId && c.vendorId === v.id && (c.scopeKind === "organization" && c.scopeId === scope.organizationId || c.scopeKind === "region" && c.scopeId === store.regionId || c.scopeKind === "store" && c.scopeId === store.id)).map(c => c.scopeKind);
    const pref = latestStorePreference(f,scope.organizationId,storeId,v.id), keys = preferenceKeys(pref);
    const specialties = f.vendorSpecialties.filter(s => s.organizationId === scope.organizationId && s.vendorId === v.id).map(s => ({key:s.canonicalKey,label:s.displayName}));
    if ((!coverage.length || v.status !== "approved") && !keys.length) return [];
    if (query.search && ![v.name,...specialties.map(s => s.label),...f.vendorSpecialties.filter(s=>s.organizationId===scope.organizationId&&s.vendorId===v.id).flatMap(s=>s.searchAliases)].join(" ").toLowerCase().includes(vendorSearchTerm(query.search))) return [];
    return [{id:v.id,name:v.name,email:v.dispatchEmail,phone:v.dispatchPhone,covered:coverage.length>0&&v.status==="approved",coverage,specialties,preferenceKeys:keys,version:pref?.version??0}];
  }).sort((a,b) => Number(b.preferenceKeys.length>0)-Number(a.preferenceKeys.length>0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const offset = Math.max(0,query.offset??0);
  return {items:rows.slice(offset,offset+25),total:rows.length,preferredTotal:rows.filter(r=>r.preferenceKeys.length).length,coveredTotal:rows.filter(r=>r.covered).length};
}
export async function queryStoreVendors(driver: OpsSqlDriver, scope: OrganizationScope, storeId: string, query: StoreVendorQuery): Promise<StoreVendorPage> {
  const params: unknown[] = [];
  const where = scopeWhere(scope,"s",params); params.push(storeId);
  const store = (await driver.query({sql:`SELECT s.* FROM ops_stores s WHERE ${where} AND s.id = ?`,params})).rows[0];
  if (!store) return {items:[],total:0,preferredTotal:0,coveredTotal:0};
  const coverage = "c.organization_id=v.organization_id AND c.vendor_id=v.id AND (c.scope_kind='organization' AND c.scope_id=v.organization_id OR c.scope_kind='region' AND c.scope_id=? OR c.scope_kind='store' AND c.scope_id=?)";
  const base = `FROM ops_vendors v LEFT JOIN ops_store_vendor_preferences p ON p.organization_id=v.organization_id AND p.vendor_id=v.id AND p.store_id=? AND p.version=(SELECT MAX(p2.version) FROM ops_store_vendor_preferences p2 WHERE p2.organization_id=p.organization_id AND p2.store_id=p.store_id AND p2.vendor_id=p.vendor_id) WHERE v.organization_id=? AND ((v.status='approved' AND EXISTS(SELECT 1 FROM ops_vendor_coverage c WHERE ${coverage})) OR COALESCE(p.trade_keys_json,'[]')<>'[]') AND (LOWER(v.search_text) LIKE ? OR EXISTS(SELECT 1 FROM ops_vendor_specialties t WHERE t.organization_id=v.organization_id AND t.vendor_id=v.id AND LOWER(t.display_name) LIKE ?))`;
  const search = `%${vendorSearchTerm(query.search??"")}%`, values=[storeId,scope.organizationId,store.region_id??"",storeId,search,search];
  const counts=(await driver.query({sql:`SELECT COUNT(*) AS total,SUM(CASE WHEN COALESCE(p.trade_keys_json,'[]')<>'[]' THEN 1 ELSE 0 END) AS preferred_total,SUM(CASE WHEN v.status='approved' AND EXISTS(SELECT 1 FROM ops_vendor_coverage c WHERE ${coverage}) THEN 1 ELSE 0 END) AS covered_total ${base}`,params:[store.region_id??"",storeId,...values]})).rows[0];
  const total=Number(counts?.total??0),preferredTotal=Number(counts?.preferred_total??0),coveredTotal=Number(counts?.covered_total??0);
  const rows=(await driver.query({sql:`SELECT v.*,p.trade_keys_json,p.version ${base} ORDER BY CASE WHEN COALESCE(p.trade_keys_json,'[]')<>'[]' THEN 0 ELSE 1 END,v.name,v.id LIMIT 25 OFFSET ?`,params:[...values,Math.max(0,query.offset??0)]})).rows;
  if(!rows.length)return {items:[],total,preferredTotal,coveredTotal};
  const ids=rows.map(r=>String(r.id)),slots=ids.map(()=>"?").join(",");
  const specialties=(await driver.query({sql:`SELECT * FROM ops_vendor_specialties WHERE organization_id=? AND vendor_id IN (${slots}) ORDER BY display_name`,params:[scope.organizationId,...ids]})).rows;
  const covers=(await driver.query({sql:`SELECT * FROM ops_vendor_coverage WHERE organization_id=? AND vendor_id IN (${slots}) AND (scope_kind='organization' AND scope_id=? OR scope_kind='region' AND scope_id=? OR scope_kind='store' AND scope_id=?)`,params:[scope.organizationId,...ids,scope.organizationId,store.region_id??"",storeId]})).rows;
  return {total,preferredTotal,coveredTotal,items:rows.map(row=>({id:String(row.id),name:String(row.name),email:String(row.dispatch_email),phone:row.dispatch_phone?String(row.dispatch_phone):undefined,covered:row.status==="approved"&&covers.some(c=>c.vendor_id===row.id),coverage:covers.filter(c=>c.vendor_id===row.id).map(c=>String(c.scope_kind)),specialties:specialties.filter(s=>s.vendor_id===row.id).map(s=>({key:String(s.canonical_key),label:String(s.display_name)})),preferenceKeys:JSON.parse(String(row.trade_keys_json??"[]")) as string[],version:Number(row.version??0)}))};
}
export async function setStoreVendorPreference(svc: OpsCommandServices, input: {organizationId:string;storeId:string;vendorId:string;tradeKeys:string[];version:number;actor:ActorContext}) {
  const {repository}=svc,org=input.organizationId;
  if(input.actor.organizationId!==org)throw new OpsDomainError("FORBIDDEN","Organization access required.");
  const [store,vendor,before]=await Promise.all([repository.getStore(org,input.storeId),repository.getVendor(org,input.vendorId),repository.getStoreVendorPreference(org,input.storeId,input.vendorId)]);
  if(!store||!vendor)throw new OpsDomainError("NOT_FOUND","Store or vendor not found.");
  if(!Number.isSafeInteger(input.version)||input.version!==(before?.version??0))throw new OpsDomainError("CONFLICT","Preferences changed. Refresh before saving.");
  const keys=[...new Set(input.tradeKeys)].sort();
  if(keys.length) {
    if(vendor.status!=="approved"||!await repository.vendorCoversStore(org,vendor.id,store.id))throw new OpsDomainError("VALIDATION","Choose an approved vendor covering this store.");
    const specialties=await repository.listVendorSpecialties(org,vendor.id);
    if(keys.length>100||keys.some(key=>key!=="*"&&!specialties.some(s=>s.canonicalKey===key))||(keys.includes("*")&&keys.length>1))throw new OpsDomainError("VALIDATION","Choose all services or the vendor's specialties.");
  }
  const now=svc.clock?.now()??new Date().toISOString(),id=`store-vendor-${crypto.randomUUID()}`;
  try { await repository.atomicWrite([
    insertRecord("ops_store_vendor_preferences",{id,organization_id:org,store_id:store.id,vendor_id:vendor.id,trade_keys_json:JSON.stringify(keys),version:input.version+1,created_at:now}),
    communicationAudit(org,store.id,"store.vendor_preference_updated",input.actor,now,{vendorId:vendor.id,before:preferenceKeys(before),after:keys},"store"),
  ]); } catch(error) {
    if(((await repository.getStoreVendorPreference(org,store.id,vendor.id))?.version??0)>input.version)throw new OpsDomainError("CONFLICT","Preferences changed. Refresh before saving.");
    throw error;
  }
}
