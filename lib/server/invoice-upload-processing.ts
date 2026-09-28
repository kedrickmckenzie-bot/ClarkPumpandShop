import "server-only";
import type { OpsRepository } from "@/lib/ops/repository";
import type { ActorContext } from "@/lib/ops/types";
import type { InvoiceUpload } from "@/lib/ops/invoice-upload-types";
import { assertInvoiceReceiver, recordInvoiceUpload, reviewInvoiceUpload } from "@/lib/ops/invoice-upload-commands";
import { readPrivateUpload } from "@/components/ops-public/server-file-store";
import { extractInvoice, invoiceReaderConfigured } from "./invoice-extractor";
export async function processInvoiceUpload(repository:OpsRepository,actor:ActorContext,row:InvoiceUpload,reader=extractInvoice) {
 await assertInvoiceReceiver(repository,actor);
 if(row.organizationId!==actor.organizationId)throw new Error("Invoice is outside your company.");
 if(row.status==="recorded"||row.status==="dismissed")return row;
 try {
  const file=await repository.getStoredFileById(row.organizationId,row.fileId);
  if(!file||file.status!=="available")throw new Error("Missing file");
  const bytes=await readPrivateUpload(file.storageKey);if(!bytes)throw new Error("Missing bytes");
  const data=await reader(bytes,file.originalName,file.contentType);
  return await recordInvoiceUpload(repository,actor,row,data);
 } catch {
  const current=await repository.getInvoiceUpload(row.organizationId,row.id);
  if(current&&current.version!==row.version)return current;
  return reviewInvoiceUpload(repository,actor,row,[invoiceReaderConfigured()?"Automatic reading could not finish. Retry or enter the details from the saved file.":"Automatic reading is not connected. Your file is saved; enter the details or retry after setup."]);
 }
}
