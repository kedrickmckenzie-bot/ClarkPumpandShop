import { z } from "zod";
const amount = z.number().int().min(0).max(999_999_999_999);
const field = z.string().max(500).nullable();
export const invoiceExtractionSchema = z.object({
  documentKind: z.enum(["invoice", "credit", "other"]), invoiceCount: z.number().int().min(0).max(100),
  vendorName: field, invoiceNumber: field, invoiceDate: field, currency: field,
  workOrderNumber: field, storeNumber: field, storeName: field, serviceAddress: field,
  totalMinor: amount.nullable(), uncertainFields: z.array(z.string().max(200)).max(100),
  lines: z.array(z.object({ category: z.enum(["labor","part","travel","diagnostic","equipment_rental","disposal","permit","tax","other_fee"]), description:z.string().min(1).max(2000), amountMinor:amount }).strict()).max(100),
}).strict();
export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;
export function invoiceReadingIssues(data: InvoiceExtraction): string[] {
  const issues: string[] = [];
  if(data.documentKind !== "invoice" || data.invoiceCount !== 1) issues.push("Upload one invoice per file. Credits and combined invoices need review.");
  if(!data.invoiceNumber?.trim()) issues.push("Invoice number could not be read.");
  if(!data.invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.invoiceDate) || !Number.isFinite(Date.parse(data.invoiceDate)) || new Date(data.invoiceDate).toISOString().slice(0,10)!==data.invoiceDate) issues.push("Invoice date could not be read.");
  if(!data.currency || !/^[A-Z]{3}$/.test(data.currency)) issues.push("Currency could not be read.");
  if(data.uncertainFields.length) issues.push(`Check the reading: ${data.uncertainFields.join(", ")}`);
  if(data.totalMinor === null || !data.lines.length || data.lines.reduce((sum,line)=>sum+line.amountMinor,0)!==data.totalMinor) issues.push("Invoice items do not add up to the document total.");
  return issues;
}
