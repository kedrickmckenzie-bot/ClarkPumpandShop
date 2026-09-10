import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { InvoiceReceiveWorkspace } from "@/components/ops/invoice-receive-workspace";
import { InvoiceDetailWorkspace,WarrantyCaseWorkspace } from "@/components/ops/warranty-finance-workspace";
import { WarrantyRuleCreateWorkspace } from "@/components/ops/warranty-rule-workspace";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture,NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
const mocks=vi.hoisted(()=>({getOpsRequestContext:vi.fn()}));
vi.mock("@/lib/server/ops-request-context",async()=>{const actual=await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");return{...actual,getOpsRequestContext:mocks.getOpsRequestContext}});
import { POST as receiveInvoicePost } from "@/app/api/ops/invoices/route";
import { POST as createRulePost } from "@/app/api/ops/warranties/rules/route";
import { POST as warrantyDecisionPost } from "@/app/api/ops/warranties/[id]/decision/route";
import { recordedWarrantyDiagnosis } from "@/lib/ops/warranty-review";

const financeSession={organizationId:NORTHLINE_ORGANIZATION_ID,role:"finance",membershipId:"membership-northline-finance",displayName:"Parker Shaw"};
const facilitiesSession={organizationId:NORTHLINE_ORGANIZATION_ID,role:"facilities",membershipId:"membership-northline-facilities",displayName:"Jordan Lee"};
function context(role:"finance"|"facilities"){const fixture=buildNorthlinePresentationFixture();const repository=createOpsFixtureRepository(fixture);const session=role==="finance"?financeSession:facilitiesSession;mocks.getOpsRequestContext.mockResolvedValue({session,repository,actor:{organizationId:NORTHLINE_ORGANIZATION_ID,actorType:"user",actorId:session.membershipId,actorName:session.displayName}});return{fixture,repository}}

describe("interactive warranty and invoice demo workspaces",()=>{
  beforeEach(()=>vi.clearAllMocks());
  it("records diagnosis and later releases the hold through audited decisions, rejecting an unspecified hold", async () => {
    const test = context("facilities");
    const item = test.fixture.warrantyCases[0];
    const initialWork = test.fixture.workOrders.find((row) => row.id === item.workOrderId)!;
    const form = new FormData();
    form.set("coverageDecision", "covered"); // Server derives the charge status; no client-generated field is needed.
    form.set("diagnosis", "Loose connection; compressor tests correctly");
    form.set("reason", "Vendor confirmed the earlier labor warranty applies");
    form.set("reviewQueue", "https://example.test/elsewhere");
    const post = () => warrantyDecisionPost(new Request(`https://ops.test/api/ops/warranties/${item.id}/decision`, { method: "POST", body: form }), { params: Promise.resolve({ id: item.id }) });
    form.set("invoiceHold", "unspecified");
    expect((await post()).status).toBe(422);
    expect(test.repository.snapshot().auditEvents.length).toBe(test.fixture.auditEvents.length);
    form.set("invoiceHold", "retain");
    const response = await post();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).not.toContain("example.test");
    let snapshot = test.repository.snapshot();
    let current = snapshot.warrantyCases.find((row) => row.id === item.id)!;
    expect(current.invoiceHold).toBe(true);
    expect(current.customerChargeStatus).toBe("warranty_covered");
    expect(recordedWarrantyDiagnosis(snapshot, current)?.diagnosis).toBe("Loose connection; compressor tests correctly");
    form.set("customerChargeStatus", "customer_responsible"); // A stale or tampered client field cannot contradict coverage.
    form.set("invoiceHold", "release"); form.set("reason", "Vendor confirmed no additional covered charge; release the warranty hold");
    expect((await post()).status).toBe(303);
    snapshot = test.repository.snapshot(); current = snapshot.warrantyCases.find((row) => row.id === item.id)!;
    expect(current.invoiceHold).toBe(false);
    expect(current.customerChargeStatus).toBe("warranty_covered");
    expect(snapshot.auditEvents.filter((row) => row.aggregateId === item.id && row.eventType === "warranty.coverage_decided")).toHaveLength(2);
    expect(snapshot.workOrders.find((row) => row.id === initialWork.id)?.status).toBe(initialWork.status);
    expect(snapshot.invoices.map((row) => row.paidAmount)).toEqual(test.fixture.invoices.map((row) => row.paidAmount));
  });
  it("renders source-intake, evidence review, flag-only language, and durable action targets",()=>{const fixture=buildNorthlinePresentationFixture();const invoice=fixture.invoices.find((item)=>item.id==="invoice-summit-104-compressor")!;const warrantyCase=fixture.warrantyCases.find((item)=>item.id==="warranty-case-104-compressor-callback")!;const markup=[renderToStaticMarkup(createElement(InvoiceReceiveWorkspace,{fixture})),renderToStaticMarkup(createElement(InvoiceDetailWorkspace,{fixture,invoice,canDecide:true})),renderToStaticMarkup(createElement(WarrantyCaseWorkspace,{fixture,warrantyCase,canManage:true})),renderToStaticMarkup(createElement(WarrantyRuleCreateWorkspace,{fixture}))].join("\n");expect(markup).toContain('action="/api/ops/invoices"');expect(markup).toContain("Checks may flag a difference");expect(markup).toContain("No deduction or credit has been recorded");expect(markup).toContain(`/api/ops/warranties/${warrantyCase.id}/decision`);expect(markup).toContain("Existing repair warranties stay unchanged.");expect(markup).toContain('action="/api/ops/warranties/rules"');});

  it("receives an entered invoice through the authorized route and persists its review flag",async()=>{const test=context("finance");const form=new FormData();form.set("workOrderId","wo-northline-104");form.set("vendorId","vendor-northline-summit");form.set("contractVersionId","contract-version-summit-refrigeration-v1");form.set("vendorInvoiceNumber","SUM-ROUTE-DEMO-1");form.set("invoiceDate","2026-08-20");form.set("currency","USD");form.set("line1Category","travel");form.set("line1Description","Separate trip charge for review");form.set("line1Amount","200.00");const response=await receiveInvoicePost(new Request("https://ops.test/api/ops/invoices",{method:"POST",body:form}));expect(response.status).toBe(303);const invoice=test.repository.snapshot().invoices.find((item)=>item.vendorInvoiceNumber==="SUM-ROUTE-DEMO-1")!;expect(invoice).toMatchObject({approvedForPayment:{amountMinor:0,currency:"USD"},paidAmount:{amountMinor:0,currency:"USD"}});expect(test.repository.snapshot().invoiceExceptions.some((item)=>item.invoiceId===invoice.id&&item.status==="open")).toBe(true);expect(test.repository.snapshot().invoiceAdjustments.some((item)=>item.invoiceId===invoice.id)).toBe(false);});

  it("creates a future effective-dated rule through the operator route",async()=>{const test=context("facilities");const form=new FormData();form.set("profileId","warranty-profile-summit-v1");form.set("priority","78");form.set("effectiveStart","2026-10-01");form.set("tradeKey","refrigeration");form.set("storeId","");form.set("travelDuration","45");form.set("travelDeductible","0");form.set("travelRouting","original_vendor_first_right_to_cure");form.set("reason","Future negotiated callback travel term");const response=await createRulePost(new Request("https://ops.test/api/ops/warranties/rules",{method:"POST",body:form}));expect(response.status).toBe(303);expect(test.repository.snapshot().warrantyRules).toContainEqual(expect.objectContaining({priority:78,effectiveStartsAt:"2026-10-01T00:00:00.000Z",tradeKey:"refrigeration"}));expect(test.repository.snapshot().warrantyAmendments).toHaveLength(test.fixture.warrantyAmendments.length);});
});
