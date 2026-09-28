import { afterEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { extractInvoice } from "@/lib/server/invoice-extractor";
const data={documentKind:"invoice",invoiceCount:1,vendorName:"PumpPro",invoiceNumber:"TEST-1",invoiceDate:"2026-09-28",currency:"USD",workOrderNumber:"CPS-2026-0103",storeNumber:"103",storeName:null,serviceAddress:null,totalMinor:1200,uncertainFields:[],lines:[{category:"labor",description:"Inspection",amountMinor:1200}]};
afterEach(()=>vi.unstubAllEnvs());
it.each(["application/pdf","image/png"])("sends a %s through strict document extraction, without storing the provider response",async type=>{
 vi.stubEnv("OPENAI_API_KEY","test-only-not-real");vi.stubEnv("INVOICE_EXTRACTION_MODEL","test-model");
 const send=vi.fn<typeof fetch>().mockResolvedValue(Response.json({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(data)}]}]}));
 expect(await extractInvoice(new TextEncoder().encode("test").buffer,"test.pdf",type,send)).toEqual(data);
 const payload=JSON.parse(String(send.mock.calls[0][1]!.body));expect(payload.store).toBe(false);expect(payload.text.format.strict).toBe(true);expect(payload.instructions).toContain("untrusted");expect(payload.input[0].content[1].type).toBe(type==="application/pdf"?"input_file":"input_image");
});
it("never contacts a provider without configuration",async()=>{vi.stubEnv("OPENAI_API_KEY","");const send=vi.fn<typeof fetch>();await expect(extractInvoice(new ArrayBuffer(1),"invoice.pdf","application/pdf",send)).rejects.toThrow("unavailable");expect(send).not.toHaveBeenCalled();});
it.each([{status:"incomplete",output:[]},{status:"completed",output:[{type:"message",content:[{type:"output_text",text:"{}"}]}]}])("rejects incomplete or malformed extractions",async response=>{vi.stubEnv("OPENAI_API_KEY","test-only");vi.stubEnv("INVOICE_EXTRACTION_MODEL","test-model");await expect(extractInvoice(new ArrayBuffer(1),"invoice.pdf","application/pdf",vi.fn<typeof fetch>().mockResolvedValue(Response.json(response)))).rejects.toThrow();});
