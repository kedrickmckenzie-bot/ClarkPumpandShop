import {describe,it,expect,vi} from "vitest";
import {createHash} from "node:crypto";
import {buildShowcaseFixture} from "@/lib/ops/showcase-fixture";
import {assertOpsFixture} from "@/lib/ops/fixtures";
import {showcaseDocuments} from "@/lib/ops/showcase-documents";
import {matchesInspection} from "@/lib/ops/compliance-types";

vi.mock("server-only",()=>({}));

describe("refreshed showcase",()=>{
  it("keeps all new stories linked and current across year boundaries",()=>{
    for(const anchor of ["2026-09-29","2027-12-28"]){
      const f=buildShowcaseFixture(anchor);assertOpsFixture(f);
      expect(f.files.every(file=>file.status==="available")).toBe(true);
      expect(f.stores).toHaveLength(15);expect(f.vendors).toHaveLength(5);
      expect(f.warrantyCases.some(c=>c.status==="closed"&&f.entityFiles.some(e=>e.entityId===c.workOrderId))).toBe(true);
      const verificationWork=f.workOrders.find(w=>w.number==="CPS-2026-0201");
      if(verificationWork) expect(f.workflowTasks.filter(t=>t.workOrderId===verificationWork.id&&t.taskType==="verify_repair").every(t=>t.assigneeName==="Store team")).toBe(true);
      expect(f.storeTasks).toHaveLength(5);expect(f.capitalPlans).toHaveLength(5);
      expect(f.inspections).toHaveLength(21);
      expect(f.capitalPlans!.filter(p=>p.targetMonth).every(p=>p.targetMonth!>anchor.slice(0,7))).toBe(true);
      expect(f.inspections!.some(i=>matchesInspection(i,"overdue",anchor))).toBe(true);
      expect(f.inspections!.some(i=>i.status==="passed"&&f.entityFiles.some(e=>e.entityId===i.workOrderId))).toBe(true);
      expect(f.inspections!.some(i=>i.status==="action_needed"&&f.workOrders.some(w=>w.id===i.correctiveWorkOrderId))).toBe(true);
      for(const t of f.storeTasks!){
        expect(f.memberships.some(m=>m.id===t.requesterId)).toBe(true);
        expect(f.storeTaskPeople!.some(p=>p.taskId===t.id&&p.membershipId===t.requesterId)).toBe(true);
        expect(f.storeTaskMessages!.some(m=>m.taskId===t.id)).toBe(true);
      }
      expect(f.approvalRequests.some(a=>a.subjectType==="service_request")).toBe(false);
      expect(buildShowcaseFixture(anchor)).toEqual(f);
    }
  });
  it("keeps example invoice summaries consistent with their source totals",()=>{
    const f=buildShowcaseFixture("2026-09-29");
    for(const id of ["invoice-northline-109","invoice-summit-104-compressor","invoice-summit-104-warranty-callback"]){
      const invoice=f.invoices.find(i=>i.id===id)!;
      const file=f.files.find(file=>file.id===invoice.supportingFileId)!;
      expect(showcaseDocuments[file.storageKey].text).toContain(`USD ${(invoice.total.amountMinor/100).toFixed(2)}`);
      expect(showcaseDocuments[file.storageKey].text).toContain(invoice.vendorInvoiceNumber);
    }
  });
  it("opens bundled evidence without requiring an upload provider",async()=>{
    const {readPrivateUpload}=await import("@/components/ops-public/server-file-store");
    const key="org-northline-demo/showcase-v1/108-food-inspection.txt";
    expect(new TextDecoder().decode((await readPrivateUpload(key))!)).toBe(showcaseDocuments[key].text);
  });
  it("bundles real readable sample-document bytes with matching metadata",()=>{
    const f=buildShowcaseFixture("2026-09-29");
    for(const file of f.files.filter(f=>f.storageKey.includes("showcase-v1"))){
      const doc=showcaseDocuments[file.storageKey];expect(doc.text).toContain("FICTIONAL DEMO");
      expect(Buffer.byteLength(doc.text)).toBe(file.byteLength);
      expect(createHash("sha256").update(doc.text).digest("hex")).toBe(file.sha256);
    }
  });
});
