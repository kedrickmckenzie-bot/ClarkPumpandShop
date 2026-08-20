import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { InvoiceReceiveWorkspace } from "@/components/ops/invoice-receive-workspace";
import { InvoiceDetailWorkspace,WarrantyCaseWorkspace } from "@/components/ops/warranty-finance-workspace";
import { WarrantyRuleCreateWorkspace } from "@/components/ops/warranty-rule-workspace";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture,NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({getOpsRequestContext:vi.fn()}));
vi.mock("@/lib/server/ops-request-context",async()=>{const actual=await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");return{...actual,getOpsRequestContext:mocks.getOpsRequestContext}});
import { POST as receiveInvoicePost } from "@/app/api/ops/invoices/route";
import { POST as createRulePost } from "@/app/api/ops/warranties/rules/route";

const financeSession={organizationId:NORTHLINE_ORGANIZATION_ID,role:"finance",membershipId:"membership-northline-finance",displayName:"Parker Shaw"};
const facilitiesSession={organizationId:NORTHLINE_ORGANIZATION_ID,role:"facilities",membershipId:"membership-northline-facilities",displayName:"Jordan Lee"};
function context(role:"finance"|"facilities"){const fixture=buildNorthlinePresentationFixture();const repository=createOpsFixtureRepository(fixture);const session=role==="finance"?financeSession:facilitiesSession;mocks.getOpsRequestContext.mockResolvedValue({session,repository,actor:{organizationId:NORTHLINE_ORGANIZATION_ID,actorType:"user",actorId:session.membershipId,actorName:session.displayName}});return{fixture,repository}}

describe("interactive warranty and invoice demo workspaces",()=>{
  beforeEach(()=>vi.clearAllMocks());
  it("renders source-intake, evidence review, flag-only language, and durable action targets",()=>{const fixture=buildNorthlinePresentationFixture();const invoice=fixture.invoices.find((item)=>item.id==="invoice-summit-104-compressor")!;const warrantyCase=fixture.warrantyCases.find((item)=>item.id==="warranty-case-104-compressor-callback")!;const markup=[renderToStaticMarkup(createElement(InvoiceReceiveWorkspace,{fixture})),renderToStaticMarkup(createElement(InvoiceDetailWorkspace,{fixture,invoice,canDecide:true})),renderToStaticMarkup(createElement(WarrantyCaseWorkspace,{fixture,warrantyCase,canManage:true})),renderToStaticMarkup(createElement(WarrantyRuleCreateWorkspace,{fixture}))].join("\n");expect(markup).toContain('action="/api/ops/invoices"');expect(markup).toContain("automated checks may identify a difference");expect(markup).toContain("No deduction or credit has been recorded");expect(markup).toContain(`/api/ops/warranties/${warrantyCase.id}/decision`);expect(markup).toContain("does not rewrite any immutable Applied Warranty");expect(markup).toContain('action="/api/ops/warranties/rules"');});

  it("receives an entered invoice through the authorized route and persists its review flag",async()=>{const test=context("finance");const form=new FormData();form.set("workOrderId","wo-northline-104");form.set("vendorId","vendor-northline-summit");form.set("contractVersionId","contract-version-summit-refrigeration-v1");form.set("vendorInvoiceNumber","SUM-ROUTE-DEMO-1");form.set("invoiceDate","2026-08-20");form.set("currency","USD");form.set("line1Category","travel");form.set("line1Description","Separate trip charge for review");form.set("line1Amount","200.00");const response=await receiveInvoicePost(new Request("https://ops.test/api/ops/invoices",{method:"POST",body:form}));expect(response.status).toBe(303);const invoice=test.repository.snapshot().invoices.find((item)=>item.vendorInvoiceNumber==="SUM-ROUTE-DEMO-1")!;expect(invoice).toMatchObject({approvedForPayment:{amountMinor:0,currency:"USD"},paidAmount:{amountMinor:0,currency:"USD"}});expect(test.repository.snapshot().invoiceExceptions.some((item)=>item.invoiceId===invoice.id&&item.status==="open")).toBe(true);expect(test.repository.snapshot().invoiceAdjustments.some((item)=>item.invoiceId===invoice.id)).toBe(false);});

  it("creates a future effective-dated rule through the operator route",async()=>{const test=context("facilities");const form=new FormData();form.set("profileId","warranty-profile-summit-v1");form.set("priority","78");form.set("effectiveStart","2026-10-01");form.set("tradeKey","refrigeration");form.set("storeId","");form.set("travelDuration","45");form.set("travelDeductible","0");form.set("travelRouting","original_vendor_first_right_to_cure");form.set("reason","Future negotiated callback travel term");const response=await createRulePost(new Request("https://ops.test/api/ops/warranties/rules",{method:"POST",body:form}));expect(response.status).toBe(303);expect(test.repository.snapshot().warrantyRules).toContainEqual(expect.objectContaining({priority:78,effectiveStartsAt:"2026-10-01T00:00:00.000Z",tradeKey:"refrigeration"}));expect(test.repository.snapshot().warrantyAmendments).toHaveLength(test.fixture.warrantyAmendments.length);});
});
