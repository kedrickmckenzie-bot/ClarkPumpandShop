import { atomicWorkOrderMutation } from "./concurrency";
import type { OpsClock, OpsCommandServices, OpsIdSource } from "./commands";
import { OpsDomainError } from "./errors";
import type { OpsRepository, OpsStatement } from "./repository";
import {
  buildCompleteWorkflowTaskStatements,
  buildCreateTaskStatements,
  buildWorkflowTaskProjectionStatement,
  buildWorkflowTaskRecord,
  isOpenWorkflowTask,
} from "./workflow-task-commands";
import type {
  ActorContext,
  AppliedWarranty,
  AssetComponent,
  ComponentLifecycleEvent,
  IsoDateTime,
  Money,
  OpsId,
  RepairItem,
  VendorWarrantyProfile,
  WarrantyCoverageLine,
  WarrantyCoverageType,
  WarrantyRoutingRule,
  WarrantyRule,
  WorkOrder,
} from "./types";

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };
const warrantyRoles = new Set(["executive", "facilities_admin", "regional_manager"]);
const routingOverrideReasons = new Set([
  "safety_emergency", "product_loss_emergency", "vendor_decline", "vendor_response_sla_failure",
  "vendor_cannot_meet_completion", "inactive_vendor", "expired_insurance_or_license",
  "manufacturer_direction", "active_dispute", "management_exception",
]);

function services(input: OpsCommandServices) {
  return { repository: input.repository, clock: input.clock ?? systemClock, ids: input.ids ?? randomIds };
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}

function required(value: string | undefined, label: string) {
  const result = value?.trim();
  if (!result) throw new OpsDomainError("VALIDATION", `${label} is required`);
  return result;
}

function nonnegativeMoney(value: Money, label: string) {
  if (!Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0 || !value.currency.trim()) {
    throw new OpsDomainError("VALIDATION", `${label} must use non-negative integer minor units and a currency`);
  }
  return value;
}

function auditAndOutbox(input: { organizationId: OpsId; aggregateType: string; aggregateId: OpsId; eventType: string; actor: ActorContext; occurredAt: IsoDateTime; payload: unknown; ids: OpsIdSource }): OpsStatement[] {
  const payloadJson = JSON.stringify(input.payload);
  return [
    insert("ops_audit_events", { id: input.ids.next("audit"), organization_id: input.organizationId, aggregate_type: input.aggregateType, aggregate_id: input.aggregateId, event_type: input.eventType, actor_type: input.actor.actorType, actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: input.occurredAt, payload_json: payloadJson }),
    insert("ops_outbox_messages", { id: input.ids.next("outbox"), organization_id: input.organizationId, topic: `ops.${input.eventType}`, aggregate_type: input.aggregateType, aggregate_id: input.aggregateId, payload_json: payloadJson, status: "pending", available_at: input.occurredAt, created_at: input.occurredAt, attempt_count: 0 }),
  ];
}

async function assertWarrantyActor(repository: OpsRepository, actor: ActorContext, organizationId: OpsId, workOrder?: WorkOrder) {
  if (actor.organizationId !== organizationId || actor.actorType !== "user" || !actor.actorId) throw new OpsDomainError("FORBIDDEN", "An authenticated warranty reviewer is required");
  const membership = await repository.getMembership(organizationId, actor.actorId);
  if (!membership || membership.status !== "active" || !warrantyRoles.has(membership.role)) throw new OpsDomainError("FORBIDDEN", "Facilities, regional manager, or executive access is required");
  if (membership.role !== "regional_manager" || !workOrder) return membership;
  const [store, grants] = await Promise.all([repository.getStore(organizationId, workOrder.storeId), repository.listScopeGrantsForMembership(organizationId, membership.id)]);
  if (!store || !grants.some((grant) => grant.scopeKind === "organization" && grant.scopeId === organizationId || grant.scopeKind === "region" && grant.scopeId === store.regionId || grant.scopeKind === "store" && grant.scopeId === store.id)) throw new OpsDomainError("FORBIDDEN", "The reviewer does not cover this store");
  return membership;
}

export interface WarrantyPreviewInput {
  organizationId: OpsId;
  vendorId: OpsId;
  contractVersionId?: OpsId;
  quoteId?: OpsId;
  authorizationId?: OpsId;
  tradeKey?: string;
  workType?: string;
  serviceType?: string;
  assetType?: string;
  componentType?: string;
  manufacturer?: string;
  model?: string;
  vendorSuppliedPart?: boolean;
  customerSuppliedPart?: boolean;
  regionId?: OpsId;
  storeId?: OpsId;
  completionDate: string;
  verificationDate?: string;
  installationDate?: string;
  commissioningDate?: string;
}

export interface WarrantyPreviewLine {
  coverage: WarrantyCoverageLine;
  rule?: WarrantyRule;
  profile: VendorWarrantyProfile;
  precedence: number;
  policySource: string;
  startDate: string;
  endDate: string;
  explanation: string;
  overriddenRuleIds: OpsId[];
}

function selectorMatches(rule: WarrantyRule, input: WarrantyPreviewInput) {
  const checks: Array<[unknown, unknown]> = [
    [rule.contractVersionId, input.contractVersionId], [rule.quoteId, input.quoteId], [rule.authorizationId, input.authorizationId],
    [rule.tradeKey, input.tradeKey], [rule.workType, input.workType], [rule.serviceType, input.serviceType],
    [rule.assetType, input.assetType], [rule.componentType, input.componentType], [rule.manufacturer, input.manufacturer],
    [rule.model, input.model], [rule.vendorSuppliedPart, input.vendorSuppliedPart], [rule.customerSuppliedPart, input.customerSuppliedPart],
    [rule.regionId, input.regionId], [rule.storeId, input.storeId],
  ];
  return checks.every(([selector, actual]) => selector === undefined || selector === actual);
}

function precedence(rule: WarrantyRule) {
  if (rule.quoteId || rule.authorizationId) return 2;
  const contract = Boolean(rule.contractVersionId);
  if (contract && rule.componentType) return 3;
  if (contract && (rule.assetType || rule.serviceType || rule.workType)) return 4;
  if (contract && rule.tradeKey) return 5;
  if (rule.componentType) return 6;
  if (rule.assetType || rule.serviceType || rule.workType) return 7;
  if (rule.tradeKey) return 8;
  return 9;
}

function addDuration(startDate: string, duration: number, unit: WarrantyCoverageLine["durationUnit"]) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isInteger(duration) || duration < 0) throw new OpsDomainError("VALIDATION", "Warranty duration is invalid");
  if (unit === "days") date.setUTCDate(date.getUTCDate() + duration);
  if (unit === "months") date.setUTCMonth(date.getUTCMonth() + duration);
  if (unit === "years") date.setUTCFullYear(date.getUTCFullYear() + duration);
  return date.toISOString().slice(0, 10);
}

function coverageDates(line: WarrantyCoverageLine, input: WarrantyPreviewInput) {
  const startDate = line.startDate ?? (line.startEvent === "store_verification" ? input.verificationDate : line.startEvent === "installation" ? input.installationDate : line.startEvent === "commissioning" ? input.commissioningDate : line.startEvent === "fixed_date" ? undefined : input.completionDate);
  if (!startDate) throw new OpsDomainError("CONFLICT", `Warranty ${line.id} requires a ${line.startEvent.replaceAll("_", " ")} date`);
  return { startDate, endDate: line.endDate ?? addDuration(startDate, line.duration, line.durationUnit) };
}

export async function previewWarrantyCoverage(input: WarrantyPreviewInput, repository: OpsRepository): Promise<WarrantyPreviewLine[]> {
  const [profiles, rules] = await Promise.all([repository.listVendorWarrantyProfiles(input.organizationId, input.vendorId), repository.listWarrantyRules(input.organizationId, input.vendorId)]);
  const completion = Date.parse(`${input.completionDate}T00:00:00.000Z`);
  const profile = profiles.find((item) => item.status === "active" && Date.parse(item.effectiveStartsAt) <= completion && (!item.effectiveEndsAt || Date.parse(item.effectiveEndsAt) >= completion));
  if (!profile) return [];
  const lines = await repository.listWarrantyCoverageLines(input.organizationId, profile.id);
  const activeRules = rules.filter((rule) => rule.status === "active" && Date.parse(rule.effectiveStartsAt) <= completion && (!rule.effectiveEndsAt || Date.parse(rule.effectiveEndsAt) >= completion) && selectorMatches(rule, input));
  const byType = new Map<WarrantyCoverageType, WarrantyPreviewLine>();
  const allTypes = new Set(lines.map((line) => line.coverageType));
  for (const type of allTypes) {
    const candidates = activeRules.flatMap((rule) => lines.filter((line) => line.warrantyRuleId === rule.id && line.coverageType === type).map((coverage) => ({ coverage, rule, precedence: precedence(rule) })));
    const base = lines.filter((line) => !line.warrantyRuleId && line.vendorWarrantyProfileId === profile.id && line.coverageType === type).map((coverage) => ({ coverage, rule: undefined, precedence: 9 }));
    const ranked = [...candidates, ...base].sort((a, b) => a.precedence - b.precedence || (a.rule?.priority ?? 999) - (b.rule?.priority ?? 999) || a.coverage.id.localeCompare(b.coverage.id));
    const winner = ranked[0];
    if (!winner) continue;
    const samePriority = ranked.filter((candidate) => candidate.precedence === winner.precedence && (candidate.rule?.priority ?? 999) === (winner.rule?.priority ?? 999));
    if (samePriority.length > 1) throw new OpsDomainError("CONFLICT", `Overlapping equal-priority ${type} warranty rules require review: ${samePriority.map((item) => item.rule?.id ?? item.coverage.id).join(", ")}`);
    const dates = coverageDates(winner.coverage, input);
    const source = winner.precedence === 2 ? "Quote- or Authorization-specific warranty term" : winner.precedence === 3 ? "Contract-specific Component rule" : winner.precedence === 4 ? "Contract-specific Asset or service rule" : winner.precedence === 5 ? "Contract-specific Trade rule" : winner.precedence === 6 ? "Vendor Component rule" : winner.precedence === 7 ? "Vendor Asset or service rule" : winner.precedence === 8 ? "Vendor Trade rule" : "Vendor base warranty";
    byType.set(type, { coverage: winner.coverage, rule: winner.rule, profile, precedence: winner.precedence, policySource: source, ...dates, explanation: `${source} supplies ${type} coverage from ${dates.startDate} through ${dates.endDate}; broader matching rules are overridden for this category only.`, overriddenRuleIds: ranked.slice(1).flatMap((item) => item.rule ? [item.rule.id] : []) });
  }
  return [...byType.values()].sort((a, b) => a.coverage.coverageType.localeCompare(b.coverage.coverageType));
}

export interface RecordRepairWarrantyInput extends Omit<RepairItem, "id" | "organizationId" | "createdAt"> {
  organizationId: OpsId;
  actor: ActorContext;
  workType?: string;
  serviceType?: string;
  assetType?: string;
  componentType?: string;
  quoteId?: OpsId;
  authorizationId?: OpsId;
  componentReplacement?: {
    installedComponentName?: string;
    partNumber?: string;
    removedAt: string;
    installedAt: string;
    warrantyEndsAt?: string;
    replacementKind: "planned" | "reactive";
    expectedLifeMonths?: number;
  };
}

export async function recordRepairAndApplyWarranty(input: RecordRepairWarrantyInput, dependencies: OpsCommandServices) {
  const { repository, clock, ids } = services(dependencies);
  const now = clock.now();
  const [workOrder, visitWork] = await Promise.all([repository.getWorkOrder(input.organizationId, input.workOrderId), repository.getSiteVisitWorkOrderById(input.organizationId, input.siteVisitWorkOrderId)]);
  if (!workOrder || !visitWork || visitWork.workOrderId !== input.workOrderId || !["completed", "no_issue_found"].includes(visitWork.outcome ?? "")) throw new OpsDomainError("CONFLICT", "Repair Items require an exact completed Site Visit / Work Order outcome");
  await assertWarrantyActor(repository, input.actor, input.organizationId, workOrder);
  const decisions = await repository.listWorkOrderVerifications(input.organizationId, input.workOrderId);
  const verification = decisions.findLast((item) => item.siteVisitWorkOrderId === input.siteVisitWorkOrderId);
  if (!verification || verification.decision !== "verified") throw new OpsDomainError("CONFLICT", "Repair Items require the exact outcome to be internally verified");
  if (workOrder.assetId !== input.assetId || workOrder.componentId && input.componentId && workOrder.componentId !== input.componentId) throw new OpsDomainError("CONFLICT", "Repair Item Asset or Component does not match the Work Order");
  const removedComponent = input.componentReplacement && input.removedComponentId
    ? await repository.getComponent(input.organizationId, input.removedComponentId)
    : null;
  if (input.componentReplacement) {
    if (!removedComponent || removedComponent.assetId !== input.assetId) throw new OpsDomainError("CONFLICT", "The removed Component must be active on the Work Order Asset");
    if (removedComponent.removedAt || removedComponent.replacedByComponentId) throw new OpsDomainError("CONFLICT", "This Component already has a recorded replacement");
    if (!input.partManufacturer?.trim() || !input.partModel?.trim()) throw new OpsDomainError("VALIDATION", "Installed Component manufacturer and model are required");
    if (Date.parse(input.componentReplacement.installedAt) < Date.parse(input.componentReplacement.removedAt)) throw new OpsDomainError("VALIDATION", "Installed date cannot precede the removal date");
    if (input.componentReplacement.expectedLifeMonths !== undefined && (!Number.isInteger(input.componentReplacement.expectedLifeMonths) || input.componentReplacement.expectedLifeMonths <= 0)) throw new OpsDomainError("VALIDATION", "Expected Component life must be a positive whole number of months");
  }
  nonnegativeMoney(input.laborCost, "Labor cost"); nonnegativeMoney(input.partCost, "Part cost");
  if (input.laborCost.currency !== input.partCost.currency) throw new OpsDomainError("VALIDATION", "Repair Item costs must share one currency");
  const store = await repository.getStore(input.organizationId, workOrder.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store not found");
  const preview = await previewWarrantyCoverage({ organizationId: input.organizationId, vendorId: input.vendorId, contractVersionId: input.contractVersionId, quoteId: input.quoteId, authorizationId: input.authorizationId, tradeKey: workOrder.categoryKey, workType: input.workType, serviceType: input.serviceType, assetType: input.assetType, componentType: input.componentType, manufacturer: input.partManufacturer, model: input.partModel, vendorSuppliedPart: input.vendorSupplied, customerSuppliedPart: !input.vendorSupplied, regionId: store.regionId, storeId: store.id, completionDate: input.completionDate, verificationDate: input.verificationDate ?? verification.decidedAt.slice(0,10), installationDate: input.completionDate, commissioningDate: input.completionDate }, repository);
  if ((await repository.listRepairItemsForAsset(input.organizationId, input.assetId)).some((item) => item.siteVisitWorkOrderId === input.siteVisitWorkOrderId)) throw new OpsDomainError("CONFLICT", "This Site Visit / Work Order outcome already has a Repair Item");
  const installedComponentId = input.componentReplacement ? ids.next("component") : input.installedComponentId;
  const repair: RepairItem = { ...input, installedComponentId, id: ids.next("repair-item"), createdAt: now };
  const statements: OpsStatement[] = [insert("ops_repair_items", { id: repair.id, organization_id: repair.organizationId, work_order_id: repair.workOrderId, site_visit_work_order_id: repair.siteVisitWorkOrderId, vendor_id: repair.vendorId, contract_version_id: repair.contractVersionId, asset_id: repair.assetId, component_id: repair.componentId, failure_code: required(repair.failureCode,"Failure code"), repair_action: required(repair.repairAction,"Repair action"), repair_severity: repair.repairSeverity, removed_component_id: repair.removedComponentId, installed_component_id: repair.installedComponentId, part_manufacturer: repair.partManufacturer, part_model: repair.partModel, serial_number: repair.serialNumber, vendor_supplied: repair.vendorSupplied, completion_date: repair.completionDate, verification_date: repair.verificationDate, labor_cost_minor: repair.laborCost.amountMinor, part_cost_minor: repair.partCost.amountMinor, currency: repair.laborCost.currency, root_cause: repair.rootCause, created_at: now })];
  let installedComponent: AssetComponent | undefined;
  let lifecycleEvent: ComponentLifecycleEvent | undefined;
  if (input.componentReplacement && removedComponent && installedComponentId) {
    installedComponent = { id: installedComponentId, organizationId: input.organizationId, assetId: input.assetId, parentComponentId: removedComponent.parentComponentId, name: input.componentReplacement.installedComponentName?.trim() || removedComponent.name.replace(/\s*\(removed.*\)$/i, ""), partNumber: input.componentReplacement.partNumber?.trim() || input.partModel?.trim(), serialNumber: input.serialNumber?.trim(), installedAt: input.componentReplacement.installedAt, warrantyEndsAt: input.componentReplacement.warrantyEndsAt, createdAt: now };
    lifecycleEvent = { id: ids.next("component-life"), organizationId: input.organizationId, assetId: input.assetId, removedComponentId: removedComponent.id, installedComponentId, repairItemId: repair.id, workOrderId: input.workOrderId, vendorId: input.vendorId, partManufacturer: input.partManufacturer!.trim(), partModel: input.partModel!.trim(), serialNumber: input.serialNumber?.trim(), removedAt: input.componentReplacement.removedAt, installedAt: input.componentReplacement.installedAt, failureMode: required(input.failureCode, "Failure mode"), rootCause: input.rootCause?.trim(), laborCost: input.laborCost, partCost: input.partCost, replacementKind: input.componentReplacement.replacementKind, expectedLifeMonths: input.componentReplacement.expectedLifeMonths, warrantyEndsAt: input.componentReplacement.warrantyEndsAt, createdAt: now };
    statements.push(
      insert("ops_asset_components", { id: installedComponent.id, organization_id: installedComponent.organizationId, asset_id: installedComponent.assetId, parent_component_id: installedComponent.parentComponentId, name: installedComponent.name, part_number: installedComponent.partNumber, serial_number: installedComponent.serialNumber, installed_at: installedComponent.installedAt, warranty_ends_at: installedComponent.warrantyEndsAt, created_at: now }),
      { sql: "UPDATE ops_asset_components SET removed_at = ?, replaced_by_component_id = ? WHERE organization_id = ? AND id = ? AND removed_at IS NULL AND replaced_by_component_id IS NULL", params: [lifecycleEvent.removedAt, installedComponent.id, input.organizationId, removedComponent.id] },
      insert("ops_component_lifecycle_events", { id: lifecycleEvent.id, organization_id: lifecycleEvent.organizationId, asset_id: lifecycleEvent.assetId, removed_component_id: lifecycleEvent.removedComponentId, installed_component_id: lifecycleEvent.installedComponentId, repair_item_id: lifecycleEvent.repairItemId, work_order_id: lifecycleEvent.workOrderId, vendor_id: lifecycleEvent.vendorId, part_manufacturer: lifecycleEvent.partManufacturer, part_model: lifecycleEvent.partModel, serial_number: lifecycleEvent.serialNumber, removed_at: lifecycleEvent.removedAt, installed_at: lifecycleEvent.installedAt, failure_mode: lifecycleEvent.failureMode, root_cause: lifecycleEvent.rootCause, labor_cost_minor: lifecycleEvent.laborCost.amountMinor, part_cost_minor: lifecycleEvent.partCost.amountMinor, currency: lifecycleEvent.laborCost.currency, replacement_kind: lifecycleEvent.replacementKind, expected_life_months: lifecycleEvent.expectedLifeMonths, warranty_ends_at: lifecycleEvent.warrantyEndsAt, created_at: now }),
    );
  }
  const applied: AppliedWarranty[] = preview.map((item) => ({ id: ids.next("applied-warranty"), organizationId: input.organizationId, repairItemId: repair.id, coverageType: item.coverage.coverageType, provider: item.coverage.provider, obligatedVendorId: item.coverage.obligatedVendorId, startDate: item.startDate, endDate: item.endDate, coveredCharges: [item.coverage.coverageType], routingRule: item.coverage.routingRule, contractVersionId: input.contractVersionId, policySource: item.policySource, ruleSource: item.rule?.id, originalCalculatedTermsJson: JSON.stringify({ coverageLine: item.coverage, rule: item.rule, precedence: item.precedence, explanation: item.explanation, overriddenRuleIds: item.overriddenRuleIds }), createdAt: now }));
  for (const warranty of applied) statements.push(insert("ops_applied_warranties", { id:warranty.id, organization_id:warranty.organizationId, repair_item_id:warranty.repairItemId, coverage_type:warranty.coverageType, provider:warranty.provider, obligated_vendor_id:warranty.obligatedVendorId, start_date:warranty.startDate, end_date:warranty.endDate, covered_charges_json:JSON.stringify(warranty.coveredCharges), routing_rule:warranty.routingRule, contract_version_id:warranty.contractVersionId, policy_source:warranty.policySource, rule_source:warranty.ruleSource, original_calculated_terms_json:warranty.originalCalculatedTermsJson, created_at:now }));
  statements.push(...auditAndOutbox({ organizationId:input.organizationId, aggregateType:"repair_item", aggregateId:repair.id, eventType:lifecycleEvent ? "component.replaced" : "repair_item.warranty_applied", actor:input.actor, occurredAt:now, payload:{ workOrderId:workOrder.id, siteVisitWorkOrderId:visitWork.id, appliedWarrantyIds:applied.map((item)=>item.id), componentLifecycleEventId:lifecycleEvent?.id, removedComponentId:lifecycleEvent?.removedComponentId, installedComponentId:lifecycleEvent?.installedComponentId, immutable:true }, ids }));
  await repository.atomicWrite(statements);
  return { repairItem: repair, appliedWarranties: applied, preview, installedComponent, componentLifecycleEvent: lifecycleEvent };
}

export async function detectPotentialWarranty(input: { organizationId: OpsId; workOrderId: OpsId; actor: ActorContext; symptom: string }, dependencies: OpsCommandServices) {
  const { repository, clock, ids } = services(dependencies); const now=clock.now();
  const workOrder=await repository.getWorkOrder(input.organizationId,input.workOrderId);
  if(!workOrder?.assetId) throw new OpsDomainError("CONFLICT","Warranty detection requires a classified Asset");
  await assertWarrantyActor(repository,input.actor,input.organizationId,workOrder);
  if((await repository.listWarrantyCases(input.organizationId)).some((item)=>item.workOrderId===workOrder.id&&!item.closedAt))throw new OpsDomainError("CONFLICT","This Work Order already has an open Warranty Case");
  const active=await repository.listActiveAppliedWarrantiesForAsset(input.organizationId,workOrder.assetId,now.slice(0,10));
  if(!active.length) return null;
  const repairItems=await repository.listRepairItemsForAsset(input.organizationId,workOrder.assetId);
  const pairs=active.map((warranty)=>({warranty,repair:repairItems.find((item)=>item.id===warranty.repairItemId)})).filter((item)=>item.repair);
  const exact=pairs.filter((item)=>workOrder.componentId&&item.repair!.componentId===workOrder.componentId);
  const chosen=(exact.length?exact:pairs).sort((a,b)=>b.warranty.endDate.localeCompare(a.warranty.endDate))[0]!;
  const confidence=exact.length?"high":"low";
  const caseId=ids.next("warranty-case");
  const routingRank:WarrantyRoutingRule[]=["original_vendor_mandatory","manufacturer_authorized_provider","original_vendor_first_right_to_cure","manual_review","any_approved_provider"];
  const related=pairs.filter((item)=>item.repair!.id===chosen.repair!.id);
  const routingRule=routingRank.find((rule)=>related.some((item)=>item.warranty.routingRule===rule))??"manual_review";
  const obligatedVendorId=related.find((item)=>item.warranty.routingRule===routingRule)?.warranty.obligatedVendorId;
  const explanation=`Potential warranty coverage found — diagnosis required. ${confidence==="high"?"Exact Asset and Component match":"Same Asset has active coverage but the failed Component is not exact"}; active coverage dates and prior repair were matched. Liability has not been determined.`;
  const task=buildWorkflowTaskRecord({id:ids.next("workflow-task"),organizationId:input.organizationId,workOrderId:workOrder.id,actor:input.actor,createdAt:now,draft:{taskType:"review_warranty",title:"Confirm diagnosis and warranty coverage",reason:explanation,assigneeType:"role",assigneeRole:"facilities_admin",assigneeName:"Warranty review",priority:"critical",blocking:true,requiredForProgress:true,dueAt:new Date(Date.parse(now)+4*60*60_000).toISOString(),applicableSlaClock:"warranty_response",completionCriteria:"Record diagnosis, decide each coverage category, confirm routing, and explicitly retain or release the invoice hold",escalationDestination:"Facilities director"}});
  const openTasks=await repository.listWorkflowTasksForWorkOrder(input.organizationId,workOrder.id);
  const potentialAmount=chosen.repair!.laborCost.amountMinor+chosen.repair!.partCost.amountMinor;
  const statements=[insert("ops_warranty_cases",{id:caseId,organization_id:input.organizationId,request_id:workOrder.requestId,work_order_id:workOrder.id,asset_id:workOrder.assetId,component_id:workOrder.componentId,prior_repair_item_id:chosen.repair!.id,applied_warranty_id:chosen.warranty.id,status:"diagnosis_required",confidence,detection_explanation:explanation,diagnosis_required:true,coverage_decision:"pending_diagnosis",customer_charge_status:"undetermined",invoice_hold:true,routing_rule:routingRule,obligated_vendor_id:obligatedVendorId,vendor_response_due_at:new Date(Date.parse(now)+2*60*60_000).toISOString(),created_at:now}),insert("ops_value_events",{id:ids.next("value-event"),organization_id:input.organizationId,category:"identified_exposure",event_type:"potential_warranty",amount_minor:potentialAmount,currency:chosen.repair!.laborCost.currency,work_order_id:workOrder.id,contract_version_id:chosen.warranty.contractVersionId,warranty_case_id:caseId,asset_id:workOrder.assetId,source_decision:"Potential warranty detection only; diagnosis and liability are pending",deduplication_key:`warranty-case:${caseId}:potential`,occurred_at:now}),...buildCreateTaskStatements({task,actor:input.actor,ids}),buildWorkflowTaskProjectionStatement(input.organizationId,workOrder.id,[...openTasks.filter(isOpenWorkflowTask),task]),...auditAndOutbox({organizationId:input.organizationId,aggregateType:"warranty_case",aggregateId:caseId,eventType:"warranty_case.detected",actor:input.actor,occurredAt:now,payload:{workOrderId:workOrder.id,confidence,diagnosisRequired:true,liabilityDetermined:false,customerChargeStatus:"undetermined",invoiceHold:true,routingRule},ids})];
  await atomicWorkOrderMutation({repository,workOrder,now,statements});
  return await repository.getWarrantyCase(input.organizationId,caseId);
}

export async function amendCompletedWarranty(input:{organizationId:OpsId;appliedWarrantyId:OpsId;actor:ActorContext;amendmentKind:"accept_calculated"|"override_coverage"|"add_manufacturer"|"add_other"|"mark_unavailable"|"correct_repair_item";amendedTerms:Record<string,unknown>;reason:string},dependencies:OpsCommandServices){
  const {repository,clock,ids}=services(dependencies);const now=clock.now();
  const warranty=await repository.getAppliedWarranty(input.organizationId,input.appliedWarrantyId);if(!warranty)throw new OpsDomainError("NOT_FOUND","Applied Warranty not found");
  const repair=await repository.getRepairItem(input.organizationId,warranty.repairItemId);const workOrder=repair?await repository.getWorkOrder(input.organizationId,repair.workOrderId):null;
  if(!repair||!workOrder)throw new OpsDomainError("NOT_FOUND","Repair Item not found");
  const membership=await assertWarrantyActor(repository,input.actor,input.organizationId,workOrder);const id=ids.next("warranty-amendment");const reason=required(input.reason,"Amendment reason");
  await repository.atomicWrite([insert("ops_warranty_amendments",{id,organization_id:input.organizationId,applied_warranty_id:warranty.id,amendment_kind:input.amendmentKind,applies_to_repair_only:true,amended_terms_json:JSON.stringify(input.amendedTerms),reason,decided_by_membership_id:membership.id,decided_by_name:input.actor.actorName,decided_at:now}),...auditAndOutbox({organizationId:input.organizationId,aggregateType:"applied_warranty",aggregateId:warranty.id,eventType:"warranty.amended_for_repair",actor:input.actor,occurredAt:now,payload:{warrantyAmendmentId:id,originalAppliedWarrantyPreserved:true,appliesToRepairOnly:true,reason},ids})]);
  return{id,appliedWarrantyId:warranty.id,appliesToRepairOnly:true,decidedAt:now};
}

export async function overrideWarrantyRouting(input:{organizationId:OpsId;warrantyCaseId:OpsId;actor:ActorContext;routingRule:WarrantyRoutingRule;obligatedVendorId?:OpsId;reasonCode:string;reasonDetail:string},dependencies:OpsCommandServices){
  const {repository,clock,ids}=services(dependencies);const now=clock.now();const warrantyCase=await repository.getWarrantyCase(input.organizationId,input.warrantyCaseId);if(!warrantyCase)throw new OpsDomainError("NOT_FOUND","Warranty Case not found");
  const workOrder=await repository.getWorkOrder(input.organizationId,warrantyCase.workOrderId);if(!workOrder)throw new OpsDomainError("NOT_FOUND","Work Order not found");await assertWarrantyActor(repository,input.actor,input.organizationId,workOrder);
  if(!routingOverrideReasons.has(input.reasonCode))throw new OpsDomainError("VALIDATION","Select an allowed warranty-routing override reason");const reasonDetail=required(input.reasonDetail,"Override explanation");
  const statements:[OpsStatement,...OpsStatement[]]=[{sql:"UPDATE ops_warranty_cases SET routing_rule = ?, obligated_vendor_id = ?, status = ? WHERE organization_id = ? AND id = ?",params:[input.routingRule,input.obligatedVendorId??null,"routed",input.organizationId,warrantyCase.id]},...auditAndOutbox({organizationId:input.organizationId,aggregateType:"warranty_case",aggregateId:warrantyCase.id,eventType:"warranty.routing_overridden",actor:input.actor,occurredAt:now,payload:{previousRoutingRule:warrantyCase.routingRule,previousObligatedVendorId:warrantyCase.obligatedVendorId,routingRule:input.routingRule,obligatedVendorId:input.obligatedVendorId,reasonCode:input.reasonCode,reasonDetail},ids})];
  await atomicWorkOrderMutation({repository,workOrder,now,statements});return await repository.getWarrantyCase(input.organizationId,warrantyCase.id);
}

export async function decideWarrantyCoverage(input:{organizationId:OpsId;warrantyCaseId:OpsId;actor:ActorContext;coverageDecision:"covered"|"not_covered"|"split";customerChargeStatus:"customer_responsible"|"warranty_covered"|"split";invoiceHold:boolean;diagnosis:string;reason:string},dependencies:OpsCommandServices){
  const {repository,clock,ids}=services(dependencies);const now=clock.now();
  const warrantyCase=await repository.getWarrantyCase(input.organizationId,input.warrantyCaseId);if(!warrantyCase)throw new OpsDomainError("NOT_FOUND","Warranty Case not found");
  const workOrder=await repository.getWorkOrder(input.organizationId,warrantyCase.workOrderId);if(!workOrder)throw new OpsDomainError("NOT_FOUND","Work Order not found");
  await assertWarrantyActor(repository,input.actor,input.organizationId,workOrder);
  const diagnosis=required(input.diagnosis,"Diagnosis");const reason=required(input.reason,"Coverage decision reason");
  if(input.coverageDecision==="covered"&&input.customerChargeStatus!=="warranty_covered")throw new OpsDomainError("VALIDATION","Covered work must be recorded as warranty covered");
  if(input.coverageDecision==="not_covered"&&input.customerChargeStatus!=="customer_responsible")throw new OpsDomainError("VALIDATION","Not-covered work must record customer responsibility");
  if(input.coverageDecision==="split"&&input.customerChargeStatus!=="split")throw new OpsDomainError("VALIDATION","Split coverage must record a split customer charge status");
  const tasks=await repository.listWorkflowTasksForWorkOrder(input.organizationId,workOrder.id);const reviewTasks=tasks.filter((task)=>isOpenWorkflowTask(task)&&task.taskType==="review_warranty");
  const status=input.coverageDecision==="not_covered"?"not_covered":input.coverageDecision==="covered"?"confirmed":"confirmed";
  const closedAt=input.coverageDecision==="not_covered"?now:undefined;
  const terminalTasks=tasks.map((task)=>reviewTasks.some((candidate)=>candidate.id===task.id)?{...task,status:"completed" as const}:task);
  const statements:OpsStatement[]=[{sql:"UPDATE ops_warranty_cases SET status = ?, diagnosis_required = ?, coverage_decision = ?, customer_charge_status = ?, invoice_hold = ?, closed_at = ? WHERE organization_id = ? AND id = ? AND coverage_decision = ?",params:[status,false,input.coverageDecision,input.customerChargeStatus,input.invoiceHold,closedAt??null,input.organizationId,warrantyCase.id,warrantyCase.coverageDecision]}];
  for(const task of reviewTasks)statements.push(...buildCompleteWorkflowTaskStatements({task,actor:input.actor,occurredAt:now,ids,resolutionNote:`${diagnosis} — ${reason}`}));
  statements.push(buildWorkflowTaskProjectionStatement(input.organizationId,workOrder.id,terminalTasks),...auditAndOutbox({organizationId:input.organizationId,aggregateType:"warranty_case",aggregateId:warrantyCase.id,eventType:"warranty.coverage_decided",actor:input.actor,occurredAt:now,payload:{coverageDecision:input.coverageDecision,customerChargeStatus:input.customerChargeStatus,invoiceHold:input.invoiceHold,diagnosis,reason,liabilityDetermined:true,operationalResolutionChanged:false,paymentExecuted:false},ids}));
  await atomicWorkOrderMutation({repository,workOrder,now,statements});return await repository.getWarrantyCase(input.organizationId,warrantyCase.id);
}

type FutureWarrantySelectors=Pick<WarrantyRule,"contractVersionId"|"quoteId"|"authorizationId"|"tradeKey"|"workType"|"serviceType"|"assetType"|"componentType"|"manufacturer"|"model"|"vendorSuppliedPart"|"customerSuppliedPart"|"regionId"|"storeId">;
export interface FutureWarrantyCoverageInput {coverageType:WarrantyCoverageType;duration:number;durationUnit:WarrantyCoverageLine["durationUnit"];startEvent:WarrantyCoverageLine["startEvent"];provider:WarrantyCoverageLine["provider"];obligatedVendorId?:OpsId;routingRule:WarrantyRoutingRule;deductible:Money;maximumCoverage?:Money;conditions?:string;exclusions?:string}

function rulesMayOverlap(left:WarrantyRule,right:WarrantyRule){
  const keys:(keyof FutureWarrantySelectors)[]=["contractVersionId","quoteId","authorizationId","tradeKey","workType","serviceType","assetType","componentType","manufacturer","model","vendorSuppliedPart","customerSuppliedPart","regionId","storeId"];
  const selectorsOverlap=keys.every((key)=>left[key]===undefined||right[key]===undefined||left[key]===right[key]);
  const leftEnd=left.effectiveEndsAt??"9999-12-31T23:59:59.999Z";const rightEnd=right.effectiveEndsAt??"9999-12-31T23:59:59.999Z";
  return selectorsOverlap&&left.effectiveStartsAt<=rightEnd&&right.effectiveStartsAt<=leftEnd;
}

/** Creates a prospective rule only; it never rewrites terms already applied to a completed repair. */
export async function createFutureWarrantyRule(input:{organizationId:OpsId;vendorId:OpsId;vendorWarrantyProfileId:OpsId;actor:ActorContext;priority:number;effectiveStartsAt:IsoDateTime;effectiveEndsAt?:IsoDateTime;selectors:FutureWarrantySelectors;coverages:FutureWarrantyCoverageInput[];reason:string},dependencies:OpsCommandServices){
  const {repository,clock,ids}=services(dependencies);const now=clock.now();const membership=await assertWarrantyActor(repository,input.actor,input.organizationId);
  const profiles=await repository.listVendorWarrantyProfiles(input.organizationId,input.vendorId);if(!profiles.some((profile)=>profile.id===input.vendorWarrantyProfileId&&profile.status==="active"))throw new OpsDomainError("NOT_FOUND","Active Vendor Warranty Profile not found");
  if(!Number.isInteger(input.priority)||input.priority<0)throw new OpsDomainError("VALIDATION","Warranty rule priority must be a non-negative integer");
  if(!Number.isFinite(Date.parse(input.effectiveStartsAt))||input.effectiveEndsAt&&!Number.isFinite(Date.parse(input.effectiveEndsAt)))throw new OpsDomainError("VALIDATION","Warranty rule effective date is invalid");
  if(input.effectiveEndsAt&&input.effectiveEndsAt<input.effectiveStartsAt)throw new OpsDomainError("VALIDATION","Warranty rule end must follow its start");
  if(!input.coverages.length)throw new OpsDomainError("VALIDATION","At least one coverage category is required");
  if(new Set(input.coverages.map((coverage)=>coverage.coverageType)).size!==input.coverages.length)throw new OpsDomainError("VALIDATION","Each coverage category may appear only once per rule");
  const rule:WarrantyRule={id:ids.next("warranty-rule"),organizationId:input.organizationId,vendorWarrantyProfileId:input.vendorWarrantyProfileId,vendorId:input.vendorId,...input.selectors,priority:input.priority,effectiveStartsAt:input.effectiveStartsAt,effectiveEndsAt:input.effectiveEndsAt,status:"active",createdAt:now};
  const existing=await repository.listWarrantyRules(input.organizationId,input.vendorId);if(existing.some((candidate)=>candidate.status==="active"&&precedence(candidate)===precedence(rule)&&candidate.priority===rule.priority&&rulesMayOverlap(candidate,rule)))throw new OpsDomainError("CONFLICT","An equal-priority overlapping warranty rule already exists; change priority, scope, or effective dates");
  const reason=required(input.reason,"Future rule reason");const statements:OpsStatement[]=[insert("ops_warranty_rules",{id:rule.id,organization_id:rule.organizationId,vendor_warranty_profile_id:rule.vendorWarrantyProfileId,vendor_id:rule.vendorId,contract_version_id:rule.contractVersionId,quote_id:rule.quoteId,authorization_id:rule.authorizationId,trade_key:rule.tradeKey,work_type:rule.workType,service_type:rule.serviceType,asset_type:rule.assetType,component_type:rule.componentType,manufacturer:rule.manufacturer,model:rule.model,vendor_supplied_part:rule.vendorSuppliedPart,customer_supplied_part:rule.customerSuppliedPart,region_id:rule.regionId,store_id:rule.storeId,priority:rule.priority,effective_starts_at:rule.effectiveStartsAt,effective_ends_at:rule.effectiveEndsAt,status:rule.status,created_at:rule.createdAt})];
  const coverageIds:OpsId[]=[];for(const coverage of input.coverages){if(!Number.isInteger(coverage.duration)||coverage.duration<0)throw new OpsDomainError("VALIDATION","Coverage duration must be a non-negative integer");nonnegativeMoney(coverage.deductible,"Coverage deductible");if(coverage.maximumCoverage)nonnegativeMoney(coverage.maximumCoverage,"Maximum coverage");const id=ids.next("warranty-coverage");coverageIds.push(id);statements.push(insert("ops_warranty_coverage_lines",{id,organization_id:input.organizationId,warranty_rule_id:rule.id,vendor_warranty_profile_id:input.vendorWarrantyProfileId,coverage_type:coverage.coverageType,duration:coverage.duration,duration_unit:coverage.durationUnit,start_event:coverage.startEvent,provider:coverage.provider,obligated_vendor_id:coverage.obligatedVendorId,routing_rule:coverage.routingRule,deductible_minor:coverage.deductible.amountMinor,currency:coverage.deductible.currency,maximum_coverage_minor:coverage.maximumCoverage?.amountMinor,conditions:coverage.conditions,exclusions:coverage.exclusions}));}
  statements.push(...auditAndOutbox({organizationId:input.organizationId,aggregateType:"warranty_rule",aggregateId:rule.id,eventType:"warranty.future_rule_created",actor:input.actor,occurredAt:now,payload:{vendorId:input.vendorId,profileId:input.vendorWarrantyProfileId,coverageIds,priority:rule.priority,effectiveStartsAt:rule.effectiveStartsAt,reason,appliesToCompletedRepairs:false,createdByMembershipId:membership.id},ids}));await repository.atomicWrite(statements);return{rule,coverageIds,appliesToCompletedRepairs:false};
}
