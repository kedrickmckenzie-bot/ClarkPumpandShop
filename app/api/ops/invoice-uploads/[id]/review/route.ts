import { invoiceUploadRecord } from "@/lib/server/invoice-upload-access";
import { recordInvoiceUpload } from "@/lib/ops/invoice-upload-commands";
import { invoiceExtractionSchema } from "@/lib/ops/invoice-extraction";
import { OpsDomainError } from "@/lib/ops/errors";
import { formText,optionalMoneyMinor,opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const c=await invoiceUploadRecord(request,(await params).id),form=await request.formData();
 if(Number(form.get("version"))!==c.row.version)throw new OpsDomainError("CONFLICT","This upload changed. Refresh before saving.");
 if(form.get("confirmed")!=="yes")throw new OpsDomainError("VALIDATION","Confirm that you checked the original invoice.");
 const count=Number(form.get("lineCount"));if(!Number.isInteger(count)||count<1||count>100)throw new OpsDomainError("VALIDATION","Add 1 to 100 items.");
 const data=invoiceExtractionSchema.parse({documentKind:"invoice",invoiceCount:1,vendorName:null,invoiceNumber:formText(form,"vendorInvoiceNumber",{required:true,max:160}),invoiceDate:formText(form,"invoiceDate",{required:true,max:10}),currency:formText(form,"currency",{required:true,max:3}).toUpperCase(),workOrderNumber:null,storeNumber:null,storeName:null,serviceAddress:null,totalMinor:optionalMoneyMinor(formText(form,"total",{required:true})),uncertainFields:[],lines:Array.from({length:count},(_,i)=>({category:formText(form,`line${i+1}Category`),description:formText(form,`line${i+1}Description`,{required:true,max:2000}),amountMinor:optionalMoneyMinor(formText(form,`line${i+1}Amount`,{required:true}))}))});
 const row=await recordInvoiceUpload(c.repository,c.actor,c.row,data,{workOrderId:formText(form,"workOrderId",{required:true}),vendorId:formText(form,"vendorId",{required:true}),contractVersionId:formText(form,"contractVersionId",{max:160})||undefined,reason:formText(form,"reviewNote",{required:true,max:2000})});
 if(!row.invoiceId)throw new OpsDomainError("CONFLICT",JSON.parse(row.issuesJson).join(" "));
 return relativeRedirect303(`/app/invoices/${encodeURIComponent(row.invoiceId)}`);
}catch(error){return opsApiError(error)}}
