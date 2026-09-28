import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import { saveInvoiceUpload,recordInvoiceUpload } from "@/lib/ops/invoice-upload-commands";
import type { InvoiceExtraction } from "@/lib/ops/invoice-extraction";
export const uploadActor={organizationId:"org-northline-demo",actorType:"user" as const,actorId:"membership-northline-facilities",actorName:"Test manager"};
export async function invoiceUploadRegression(repository:OpsRepository){
 const org=uploadActor.organizationId,work=(await repository.getWorkOrder(org,"wo-northline-103"))!,vendor=(await repository.getVendor(org,(await repository.getInvoiceVendorId(org,work.id))!))!,store=(await repository.getStore(org,work.storeId))!;
 const file={id:"file-upload-regression",organizationId:org,storageKey:"test/invoice.pdf",sha256:"e".repeat(64),originalName:"inspection-invoice.pdf",contentType:"application/pdf",byteLength:100,status:"available" as const,createdAt:new Date().toISOString()};
 const row=await saveInvoiceUpload(repository,uploadActor,file);expect(row.status).toBe("queued");
 expect((await saveInvoiceUpload(repository,uploadActor,{...file,id:"duplicate-file"})).id).toBe(row.id);
 expect(await repository.getInvoiceUpload("other",row.id)).toBeNull();expect(await repository.listInvoiceUploads("other",{})).toEqual([]);
 const data:InvoiceExtraction={documentKind:"invoice",invoiceCount:1,vendorName:vendor.name,invoiceNumber:"UPLOAD-REGRESSION-1",invoiceDate:"2026-09-28",currency:"USD",workOrderNumber:work.number,storeNumber:store.storeNumber,storeName:null,serviceAddress:null,totalMinor:1200,uncertainFields:[],lines:[{category:"labor",description:"Inspection",amountMinor:1200}]};
 const review=await recordInvoiceUpload(repository,uploadActor,row,{...data,storeNumber:"999"});expect(review.status).toBe("review");expect(review.issuesJson).toContain("Store number");
 const recorded=await recordInvoiceUpload(repository,uploadActor,review,data);expect(recorded.status).toBe("recorded");
 const invoice=await repository.getInvoice(org,recorded.invoiceId!);expect(invoice).toMatchObject({supportingFileId:file.id,total:{amountMinor:1200},approvedForPayment:{amountMinor:0},paidAmount:{amountMinor:0}});
 expect((await repository.listFilesForEntity(org,"invoice",recorded.invoiceId!)).map(f=>f.id)).toContain(file.id);
 expect((await recordInvoiceUpload(repository,uploadActor,recorded,data)).invoiceId).toBe(recorded.invoiceId);
 expect((await repository.listInvoiceUploads(org,{status:"pending"})).some(r=>r.id===row.id)).toBe(false);
 const another=await saveInvoiceUpload(repository,uploadActor,{...file,id:"file-upload-regression-2",storageKey:"test/invoice2.pdf",sha256:"f".repeat(64)});
 const duplicate=await recordInvoiceUpload(repository,uploadActor,another,data);expect(duplicate.status).toBe("review");expect(duplicate.issuesJson).toContain("already been received");
}
