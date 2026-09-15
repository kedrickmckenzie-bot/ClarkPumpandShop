import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { invoiceEvidenceFromFixture, type InvoiceEvidenceQuery } from "@/lib/ops/invoice-evidence-query";
export async function invoiceEvidenceQueryRegression(repository:OpsRepository,fixture:OpsFixture){
 const organizationId=fixture.organizations[0].id,base:InvoiceEvidenceQuery={currency:"USD",limit:25,from:"2025-09-01",to:"2026-08-25"};
 for(const scope of [{organizationId},{organizationId,storeIds:[]},{organizationId,storeIds:["store-northline-104"]},{organizationId:"other"}]) expect(await repository.listInvoiceEvidence(scope,base)).toEqual(invoiceEvidenceFromFixture(fixture,scope,base));
 for(const change of [{offset:25},{offset:10000},{currency:"CAD"},{search:"%_"},{costMonth:"2026-07",store:"store-northline-104"},{category:"unclassified",asset:"unlinked",component:"unlinked"},{region:fixture.regions[0].id},{asset:fixture.assets[0].id,path:["refrigeration"]},{component:fixture.components[0].id}]){const q={...base,...change};expect(await repository.listInvoiceEvidence({organizationId},q)).toEqual(invoiceEvidenceFromFixture(fixture,{organizationId},q));}
}
