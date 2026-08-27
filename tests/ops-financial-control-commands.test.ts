import { describe, expect, it } from "vitest";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { flagInvoiceReview, receiveInvoice, resolveInvoiceReview } from "@/lib/ops/financial-control-commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const financeActor={organizationId:NORTHLINE_ORGANIZATION_ID,actorType:"user" as const,actorId:"membership-northline-finance",actorName:"Parker Shaw"};
function harness(){const fixture=buildNorthlinePresentationFixture();const repository=createOpsFixtureRepository(fixture);let sequence=0;const services:OpsCommandServices={repository,clock:{now:()=>"2026-08-20T15:00:00.000Z"},ids:{next:(prefix)=>`${prefix}-financial-test-${++sequence}`}};return{fixture,repository,services};}

describe("directive financial safeguard decisions",()=>{
  it("receives a durable source invoice and turns a trip difference into a review flag only",async()=>{
    const test=harness();const result=await receiveInvoice({organizationId:NORTHLINE_ORGANIZATION_ID,invoiceId:"invoice-interactive-demo-test",vendorId:"vendor-northline-summit",contractVersionId:"contract-version-summit-refrigeration-v1",workOrderId:"wo-northline-104",vendorInvoiceNumber:"SUM-DEMO-NEW-1",invoiceDate:"2026-08-20",currency:"USD",lines:[{category:"labor",description:"Callback diagnosis",amount:{amountMinor:16_500,currency:"USD"}},{category:"travel",description:"Separate trip charge",amount:{amountMinor:20_000,currency:"USD"}}],supportingFile:{id:"file-invoice-demo-test",storageKey:"ops-private/v1/demo/invoice.pdf",sha256:"a".repeat(64),originalName:"invoice.pdf",contentType:"application/pdf",byteLength:1200},actor:financeActor},test.services);
    const snapshot=test.repository.snapshot();expect(result.flagCount).toBeGreaterThan(0);expect(result.paymentExecuted).toBe(false);expect(result.operationalResolutionChanged).toBe(false);
    expect(snapshot.invoices.find((invoice)=>invoice.id===result.invoiceId)).toMatchObject({vendorInvoiceNumber:"SUM-DEMO-NEW-1",approvedForPayment:{amountMinor:0,currency:"USD"},paidAmount:{amountMinor:0,currency:"USD"}});
    expect(snapshot.invoiceReferences.find((invoice)=>invoice.id===result.invoiceId)).toMatchObject({invoiceNumber:"SUM-DEMO-NEW-1",operatorWorkOrderNumber:"CPS-2026-0104",matchStatus:"confirmed",grossAmount:{amountMinor:36_500,currency:"USD"}});
    expect(snapshot.invoiceAllocations.find((allocation)=>allocation.invoiceReferenceId===result.invoiceId)).toMatchObject({workOrderId:"wo-northline-104",amount:{amountMinor:36_500,currency:"USD"}});
    expect(snapshot.invoiceLines.filter((line)=>line.invoiceId===result.invoiceId)).toHaveLength(2);expect(snapshot.invoiceLineAllocations.filter((item)=>snapshot.invoiceLines.some((line)=>line.invoiceId===result.invoiceId&&line.id===item.invoiceLineId)).every((item)=>item.workOrderId==="wo-northline-104")).toBe(true);
    expect(snapshot.invoiceExceptions.some((item)=>item.invoiceId===result.invoiceId&&item.status==="open"&&["contract_rate","unsupported_trip_charge"].includes(item.kind))).toBe(true);expect(snapshot.invoiceAdjustments.some((item)=>item.invoiceId===result.invoiceId)).toBe(false);expect(snapshot.valueEvents.filter((event)=>event.category==="realized_verified"&&snapshot.invoiceLines.some((line)=>line.invoiceId===result.invoiceId&&line.id===event.invoiceLineId))).toHaveLength(0);
    expect(snapshot.entityFiles).toContainEqual(expect.objectContaining({entityType:"invoice",entityId:result.invoiceId,purpose:"invoice"}));expect(snapshot.workflowTasks.some((task)=>task.workOrderId==="wo-northline-104"&&task.taskType==="resolve_invoice_exception"&&task.status==="open")).toBe(true);
  });

  it("prevents an exact Vendor invoice-number duplicate",async()=>{const test=harness();await expect(receiveInvoice({organizationId:NORTHLINE_ORGANIZATION_ID,vendorId:"vendor-northline-summit",workOrderId:"wo-northline-104",vendorInvoiceNumber:"SUM-104-2607",invoiceDate:"2026-08-20",currency:"USD",lines:[{category:"labor",description:"Duplicate",amount:{amountMinor:100,currency:"USD"}}],actor:financeActor},test.services)).rejects.toMatchObject({code:"CONFLICT"});});
  it("flags a second invoice allocated to the same exact work order without relying on amount similarity",async()=>{
    const test=harness();
    const prior=test.repository.snapshot().invoices.find((row)=>row.id==="invoice-summit-104-compressor")!;
    const result=await receiveInvoice({organizationId:NORTHLINE_ORGANIZATION_ID,vendorId:prior.vendorId,workOrderId:"wo-northline-104",vendorInvoiceNumber:"SUM-ALT-NUMBER-9",invoiceDate:"2026-08-20",currency:"USD",lines:[{category:"labor",description:"Separate callback diagnosis",amount:{amountMinor:16_500,currency:"USD"}}],actor:financeActor},test.services);
    const snapshot=test.repository.snapshot();
    expect(snapshot.invoiceExceptions.some((item)=>item.invoiceId===result.invoiceId&&item.kind==="duplicate_invoice"&&item.status==="open")).toBe(true);
    expect(snapshot.valueEvents.some((event)=>event.category==="identified_exposure"&&event.eventType==="invoice_duplicate_invoice"&&event.deduplicationKey.includes("duplicate_invoice"))).toBe(true);
    expect(snapshot.invoiceAdjustments.some((item)=>item.invoiceId===result.invoiceId)).toBe(false);
    expect(result.paymentExecuted).toBe(false);
  });
  it("flags a proposed deduction without changing money or claiming realized value",async()=>{
    const test=harness();const before=test.repository.snapshot().invoices.find((row)=>row.id==="invoice-summit-104-compressor")!;
    const result=await flagInvoiceReview({organizationId:NORTHLINE_ORGANIZATION_ID,invoiceId:before.id,invoiceLineId:"invoice-line-104-trip",actor:{organizationId:NORTHLINE_ORGANIZATION_ID,actorType:"system",actorName:"Invoice safeguards"},kind:"authorization",summary:"Review whether the travel line is inside the authorized scope",amount:{amountMinor:12_500,currency:"USD"},evidence:{invoiceLineCategory:"travel",authorizationCeilingMinor:945_000,automaticValidityDecision:false}},test.services);
    const snapshot=test.repository.snapshot();const after=snapshot.invoices.find((row)=>row.id===before.id)!;
    expect(result.reviewOnly).toBe(true);expect(after.approvedForPayment).toEqual(before.approvedForPayment);expect(snapshot.invoiceAdjustments).toHaveLength(0);
    expect(snapshot.valueEvents.find((row)=>row.id===result.valueEventId)?.category).toBe("identified_exposure");
    expect(snapshot.valueEvents.some((row)=>row.category==="realized_verified"&&row.invoiceLineId==="invoice-line-104-trip")).toBe(false);
  });

  it("creates a deduction and realized event only after an authorized human decision",async()=>{
    const test=harness();const result=await resolveInvoiceReview({organizationId:NORTHLINE_ORGANIZATION_ID,invoiceId:"invoice-summit-104-compressor",exceptionId:"invoice-exception-104-authorization",actor:financeActor,decision:"deduct",reason:"Reviewed the contract, authorization, and change-order evidence; the added controls line is not supported for this invoice",deductionAmount:{amountMinor:212_500,currency:"USD"}},test.services);
    const snapshot=test.repository.snapshot();
    expect(result.adjustment?.kind).toBe("deduction");expect(result.valueEvent?.category).toBe("realized_verified");expect(result.paymentExecuted).toBe(false);expect(result.operationalResolutionChanged).toBe(false);
    expect(snapshot.invoices.find((row)=>row.id==="invoice-summit-104-compressor")?.approvedForPayment.amountMinor).toBe(945_000);
    expect(snapshot.workOrders.find((row)=>row.id==="wo-northline-104")?.status).toBe("closed");
  });

  it("enforces segregation of duties for the invoice submitter",async()=>{
    const fixture=buildNorthlinePresentationFixture();const invoice=fixture.invoices.find((row)=>row.id==="invoice-summit-104-compressor")!;invoice.submittedByMembershipId=financeActor.actorId;const repository=createOpsFixtureRepository(fixture);const services:OpsCommandServices={repository,clock:{now:()=>"2026-08-20T15:00:00.000Z"},ids:{next:(prefix)=>`${prefix}-sod-test`}};
    await expect(resolveInvoiceReview({organizationId:NORTHLINE_ORGANIZATION_ID,invoiceId:invoice.id,exceptionId:"invoice-exception-104-authorization",actor:financeActor,decision:"accept_as_billed",reason:"Reviewed against supporting evidence"},services)).rejects.toMatchObject({code:"FORBIDDEN"});
  });
});
