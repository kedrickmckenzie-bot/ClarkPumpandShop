import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest } from "./types";
import { pmStoreAllowed } from "./pm-record-query";
import { dashboardPageBounds } from "./dashboard-query";
export const coverageViews = ["active", "expiring", "review", "expired", "all"] as const;
export type CoverageView = typeof coverageViews[number];
export interface WarrantyDirectoryQuery extends PageRequest { today: string; view: CoverageView; search?: string; id?: string; assetId?: string; vendorId?: string }
export interface WarrantyDirectoryRow {
 id: string; kind: "registered" | "repair"; assetId: string; assetName: string; assetTag: string;
 storeId: string; storeNumber: string; storeName: string; address: string; component?: string;
 title: string; provider: string; vendorId?: string; start: string; end: string; parts: string; labor: string; travel: string;
 instructions?: string; providerRule?: string; contact?: string; workId?: string; amended: boolean;
 status: "Active" | "Starts later" | "Expired" | "Review terms";
}
export interface WarrantyDirectoryPage { items: WarrantyDirectoryRow[]; totalCount: number; counts: Record<CoverageView,number>; nextOffset?: number }
export function warrantyStatus(start:string,end:string,amended:boolean,today:string): WarrantyDirectoryRow["status"] { return amended?"Review terms":start>today?"Starts later":end<today?"Expired":"Active"; }
export function coverageEndWindow(today:string) { const d=new Date(today+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+90);return d.toISOString().slice(0,10); }
export function warrantyDirectoryFromFixture(f:OpsFixture,scope:OrganizationScope,q:WarrantyDirectoryQuery):WarrantyDirectoryPage {
 const stores=new Map(f.stores.filter(s=>pmStoreAllowed(scope,s)).map(s=>[s.id,s]));
 const assets=new Map(f.assets.filter(a=>a.organizationId===scope.organizationId&&stores.has(a.storeId)).map(a=>[a.id,a]));
 const items:WarrantyDirectoryRow[]=[];
 const base=(assetId:string)=>{const a=assets.get(assetId)!;const s=stores.get(a.storeId)!;return {assetId,assetName:a.name,assetTag:a.assetTag,storeId:s.id,storeNumber:s.storeNumber,storeName:s.name,address:[s.address1,s.city,s.state,s.postalCode].filter(Boolean).join(" ")};};
 const component=(id?:string)=>f.components.find(c=>c.organizationId===scope.organizationId&&c.id===id)?.name;
 for(const w of f.manufacturerWarranties.filter(w=>w.organizationId===scope.organizationId&&assets.has(w.assetId))) items.push({...base(w.assetId),id:w.id,kind:"registered",component:component(w.componentId),title:w.title??(w.providerKind==="vendor"?"Vendor work warranty":"Manufacturer warranty"),provider:w.manufacturer,vendorId:w.vendorId,start:w.startDate.slice(0,10),end:w.expirationDate.slice(0,10),parts:w.partsCoverage,labor:w.laborCoverage,travel:w.travelCoverage??"Not recorded",instructions:w.claimRequirements,providerRule:w.authorizedProviderRule,contact:w.administrator,workId:w.workOrderId,amended:false,status:warrantyStatus(w.startDate.slice(0,10),w.expirationDate.slice(0,10),false,q.today)});
 for(const w of f.appliedWarranties.filter(w=>w.organizationId===scope.organizationId)) {const r=f.repairItems.find(r=>r.organizationId===scope.organizationId&&r.id===w.repairItemId&&assets.has(r.assetId));if(!r)continue;
 const amended=f.warrantyAmendments.some(a=>a.organizationId===scope.organizationId&&a.appliedWarrantyId===w.id&&a.amendmentKind!=="accept_calculated");
 items.push({...base(r.assetId),id:w.id,kind:"repair",component:component(r.componentId),title:w.coverageType.replaceAll("_"," ")+" repair warranty",provider:f.vendors.find(v=>v.organizationId===scope.organizationId&&v.id===w.obligatedVendorId)?.name??w.provider,vendorId:w.obligatedVendorId,start:w.startDate.slice(0,10),end:w.endDate.slice(0,10),parts:(w.coverageType==="part"||w.coveredCharges.includes("part"))?"Covered by this term":"Not included in this term",labor:(w.coverageType==="labor"||w.coveredCharges.includes("labor"))?"Covered by this term":"Not included in this term",travel:(w.coverageType==="travel"||w.coveredCharges.includes("travel"))?"Covered by this term":"Not included in this term",instructions:w.policySource,providerRule:w.routingRule,workId:r.workOrderId,amended,status:warrantyStatus(w.startDate.slice(0,10),w.endDate.slice(0,10),amended,q.today)});}
 const found=items.filter(r=>(!q.id||r.id===q.id)&&(!q.assetId||r.assetId===q.assetId)&&(!q.vendorId||r.vendorId===q.vendorId)&&(!q.search||[r.title,r.provider,r.assetName,r.assetTag,r.storeNumber,r.storeName,r.address,r.component,...(stores.get(r.storeId)?.aliases??[])].join(" ").toLowerCase().includes(q.search.toLowerCase())));
 const matches=(r:WarrantyDirectoryRow,v:CoverageView)=>v==="all"||v==="active"&&r.status==="Active"||v==="expiring"&&r.status==="Active"&&r.end<=coverageEndWindow(q.today)||v==="review"&&r.amended||v==="expired"&&r.status==="Expired";
 const counts=Object.fromEntries(coverageViews.map(v=>[v,found.filter(r=>matches(r,v)).length])) as Record<CoverageView,number>;
 const rows=found.filter(r=>matches(r,q.view)).sort((a,b)=>a.end.localeCompare(b.end)||a.id.localeCompare(b.id)),{limit,offset}=dashboardPageBounds(q);
 return {items:rows.slice(offset,offset+limit),totalCount:rows.length,counts,nextOffset:offset+limit<rows.length?offset+limit:undefined};
}
