import { describe, expect, it } from "vitest";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { amendCompletedWarranty, createFutureWarrantyRule, decideWarrantyCoverage, detectPotentialWarranty, previewWarrantyCoverage, recordRepairAndApplyWarranty } from "@/lib/ops/warranty-commands";

const actor={organizationId:NORTHLINE_ORGANIZATION_ID,actorType:"user" as const,actorId:"membership-northline-facilities",actorName:"Jordan Lee"};
function harness(){const fixture=buildNorthlinePresentationFixture();const repository=createOpsFixtureRepository(fixture);let sequence=0;const services:OpsCommandServices={repository,clock:{now:()=>"2026-08-20T14:00:00.000Z"},ids:{next:(prefix)=>`${prefix}-warranty-test-${++sequence}`}};return{fixture,repository,services};}
function previewInput(){return{organizationId:NORTHLINE_ORGANIZATION_ID,vendorId:"vendor-northline-summit",contractVersionId:"contract-version-summit-refrigeration-v1",tradeKey:"refrigeration",workType:"reactive_repair",serviceType:"compressor_replacement",assetType:"beer_cave",componentType:"compressor",manufacturer:"Copeland",model:"ZB38KCE-TFD",vendorSuppliedPart:true,customerSuppliedPart:false,regionId:"region-northline-north",storeId:"store-northline-104",completionDate:"2026-07-10",verificationDate:"2026-07-10",installationDate:"2026-07-10",commissioningDate:"2026-07-10"};}

describe("directive warranty architecture",()=>{
  it("creates an effective-dated future rule without changing historical Applied Warranty",async()=>{const test=harness();const appliedBefore=test.repository.snapshot().appliedWarranties;const result=await createFutureWarrantyRule({organizationId:NORTHLINE_ORGANIZATION_ID,vendorId:"vendor-northline-summit",vendorWarrantyProfileId:"warranty-profile-summit-v1",actor,priority:77,effectiveStartsAt:"2026-09-01T00:00:00.000Z",selectors:{tradeKey:"refrigeration",storeId:"store-northline-105"},coverages:[{coverageType:"travel",duration:60,durationUnit:"days",startEvent:"repair_completion",provider:"vendor",obligatedVendorId:"vendor-northline-summit",routingRule:"original_vendor_first_right_to_cure",deductible:{amountMinor:0,currency:"USD"}}],reason:"Future Store 105 refrigeration terms"},test.services);const snapshot=test.repository.snapshot();expect(result.appliesToCompletedRepairs).toBe(false);expect(snapshot.warrantyRules).toContainEqual(expect.objectContaining({id:result.rule.id,effectiveStartsAt:"2026-09-01T00:00:00.000Z"}));expect(snapshot.appliedWarranties).toEqual(appliedBefore);});

  it("records diagnosis and responsibility while explicitly retaining the invoice hold",async()=>{const test=harness();const result=await decideWarrantyCoverage({organizationId:NORTHLINE_ORGANIZATION_ID,warrantyCaseId:"warranty-case-104-compressor-callback",actor,coverageDecision:"covered",customerChargeStatus:"warranty_covered",invoiceHold:true,diagnosis:"Installed compressor has an internally shorted winding related to the prior repair",reason:"Exact component, serial, failure, and active part term confirmed"},test.services);const snapshot=test.repository.snapshot();expect(result).toMatchObject({coverageDecision:"covered",customerChargeStatus:"warranty_covered",invoiceHold:true,diagnosisRequired:false});expect(snapshot.workflowTasks.filter((task)=>task.workOrderId===result?.workOrderId&&task.taskType==="review_warranty").every((task)=>task.status==="completed")).toBe(true);expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({aggregateId:result?.id,eventType:"warranty.coverage_decided"}));});
  it("resolves each coverage category independently with source and dates",async()=>{
    const test=harness();const preview=await previewWarrantyCoverage(previewInput(),test.repository);
    expect(preview.map((item)=>item.coverage.coverageType).sort()).toEqual(["diagnostic","labor","part","travel"]);
    expect(preview.every((item)=>item.precedence===3&&item.policySource==="Contract-specific Component rule")).toBe(true);
    expect(preview.find((item)=>item.coverage.coverageType==="part")?.endDate).toBe("2027-07-10");
    expect(preview.find((item)=>item.coverage.coverageType==="travel")?.endDate).toBe("2026-08-09");
  });

  it("rejects silently overlapping equal-priority rules",async()=>{
    const fixture=buildNorthlinePresentationFixture();fixture.warrantyRules.push({...fixture.warrantyRules[0]!,id:"warranty-rule-overlap"});fixture.warrantyCoverageLines.push({...fixture.warrantyCoverageLines[0]!,id:"warranty-line-overlap",warrantyRuleId:"warranty-rule-overlap"});const repository=createOpsFixtureRepository(fixture);
    await expect(previewWarrantyCoverage(previewInput(),repository)).rejects.toMatchObject({code:"CONFLICT"});
  });

  it("detects potential coverage without deciding liability and creates a review obligation",async()=>{
    const test=harness();test.fixture.workOrders.push({id:"wo-warranty-detection-test",organizationId:NORTHLINE_ORGANIZATION_ID,number:"NL-2026-WTEST",storeId:"store-northline-104",problem:"Replacement compressor is cycling on overload",categoryKey:"refrigeration",assetId:"asset-104-beer-cave",componentId:"component-104-compressor",priority:"urgent",status:"approved",version:0,accountableParty:"Facilities",nextAction:"Review issue",dueAt:"2026-08-20T18:00:00.000Z",escalationTo:"Facilities director",createdAt:"2026-08-20T13:00:00.000Z"});const repository=createOpsFixtureRepository(test.fixture);const services={...test.services,repository};
    const result=await detectPotentialWarranty({organizationId:NORTHLINE_ORGANIZATION_ID,workOrderId:"wo-warranty-detection-test",actor,symptom:"cycling on overload"},services);
    const snapshot=repository.snapshot();expect(result).toMatchObject({confidence:"high",diagnosisRequired:true,coverageDecision:"pending_diagnosis",customerChargeStatus:"undetermined",invoiceHold:true});
    expect(snapshot.workflowTasks.some((task)=>task.workOrderId==="wo-warranty-detection-test"&&task.taskType==="review_warranty"&&task.status==="open")).toBe(true);
    expect(snapshot.valueEvents.find((event)=>event.warrantyCaseId===result?.id)?.category).toBe("identified_exposure");
    expect(snapshot.valueEvents.some((event)=>event.warrantyCaseId===result?.id&&event.category==="realized_verified")).toBe(false);
  });

  it("amends completed coverage without overwriting the immutable Applied Warranty",async()=>{
    const test=harness();const before=test.repository.snapshot().appliedWarranties.find((item)=>item.id==="applied-warranty-104-compressor-labor")!;
    const result=await amendCompletedWarranty({organizationId:NORTHLINE_ORGANIZATION_ID,appliedWarrantyId:before.id,actor,amendmentKind:"override_coverage",amendedTerms:{endDate:"2026-11-08"},reason:"Vendor confirmed a one-time 30-day labor extension for this repair"},test.services);
    const snapshot=test.repository.snapshot();expect(result.appliesToRepairOnly).toBe(true);expect(snapshot.appliedWarranties.find((item)=>item.id===before.id)).toEqual(before);expect(snapshot.warrantyAmendments).toContainEqual(expect.objectContaining({appliedWarrantyId:before.id,appliesToRepairOnly:true}));expect(snapshot.warrantyRules).toHaveLength(test.fixture.warrantyRules.length);
  });

  it("atomically records a structured Component replacement, successor, warranties, and audit", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const prior = fixture.repairItems.find((item) => item.id === "repair-item-104-compressor-2026-07")!;
    fixture.componentLifecycleEvents = fixture.componentLifecycleEvents.filter((item) => item.repairItemId !== prior.id);
    fixture.appliedWarranties = fixture.appliedWarranties.filter((item) => item.repairItemId !== prior.id);
    fixture.repairItems = fixture.repairItems.filter((item) => item.id !== prior.id);
    const work = fixture.workOrders.find((item) => item.id === prior.workOrderId)!;
    work.componentId = "component-104-compressor";
    const repository = createOpsFixtureRepository(fixture); let sequence = 0;
    const result = await recordRepairAndApplyWarranty({ organizationId: NORTHLINE_ORGANIZATION_ID, actor, workOrderId: work.id, siteVisitWorkOrderId: prior.siteVisitWorkOrderId, vendorId: prior.vendorId, contractVersionId: prior.contractVersionId, assetId: prior.assetId, componentId: work.componentId, failureCode: "compressor-ground-fault", repairAction: "Removed failed compressor and commissioned the replacement", repairSeverity: "major", removedComponentId: work.componentId, partManufacturer: "Copeland", partModel: "ZB38KCE-TFD", serialNumber: "CMP-NEW-2026", vendorSupplied: true, completionDate: "2026-07-10", verificationDate: "2026-07-10", laborCost: { amountMinor: 165_000, currency: "USD" }, partCost: { amountMinor: 725_000, currency: "USD" }, rootCause: "Internal winding insulation failure", workType: "reactive_repair", serviceType: "compressor_replacement", assetType: "beer_cave", componentType: "compressor", componentReplacement: { installedComponentName: "Compressor", partNumber: "ZB38KCE-TFD", removedAt: "2026-07-10", installedAt: "2026-07-10", warrantyEndsAt: "2027-07-10", replacementKind: "reactive", expectedLifeMonths: 96 } }, { repository, clock: { now: () => "2026-08-20T14:00:00.000Z" }, ids: { next: (prefix) => `${prefix}-component-test-${++sequence}` } });
    const snapshot = repository.snapshot();
    expect(result.componentLifecycleEvent).toMatchObject({ removedComponentId: work.componentId, repairItemId: result.repairItem.id, expectedLifeMonths: 96 });
    expect(snapshot.components.find((item) => item.id === work.componentId)).toMatchObject({ removedAt: "2026-07-10", replacedByComponentId: result.installedComponent?.id });
    expect(snapshot.components).toContainEqual(expect.objectContaining({ id: result.installedComponent?.id, serialNumber: "CMP-NEW-2026" }));
    expect(snapshot.appliedWarranties.some((item) => item.repairItemId === result.repairItem.id)).toBe(true);
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: result.repairItem.id, eventType: "component.replaced" }));
  });
});
