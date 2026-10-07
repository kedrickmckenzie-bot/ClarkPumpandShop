import { buildNorthlinePresentationFixture } from "./fixtures";
import { showcaseDocuments } from "./showcase-documents";
import type { OpsFixture, StoredFile } from "./types";
import type { StoreTask } from "./store-task-types";

/** Fresh showcase only. Never merge this over a customer's existing records. */
export function buildShowcaseFixture(anchorDate = new Date().toISOString(), options: { operatingHistory?: boolean } = {}): OpsFixture {
  // The two-year operating history is on by default; turning it off rebuilds the earlier showcase for comparison.
  const f = buildNorthlinePresentationFixture(anchorDate, { operatingHistory: options.operatingHistory ?? true });
  const org = f.organizations[0].id;
  const facility = "membership-northline-facilities";
  const day = (offset: number) => new Date(Date.parse(f.asOf) + offset * 86400000).toISOString();
  const date = (offset: number) => day(offset).slice(0, 10);
  const member = (store: number) => `membership-northline-store-${store}`;
  const name = (membershipId: string) => f.users.find(u => u.id === f.memberships.find(m => m.id === membershipId)?.userId)!.displayName;
  const audit = (type: string, id: string, event: string, when: string, payload: object) => f.auditEvents.push({ id: `showcase-audit-${id}-${event}`, organizationId: org, aggregateType: type, aggregateId: id, eventType: event, actorType: "user", actorId: facility, actorName: name(facility), occurredAt: when, payloadJson: JSON.stringify(payload) });

  const document = (fileName: string): StoredFile => {
    const storageKey = `org-northline-demo/showcase-v1/${fileName}`;
    const source = showcaseDocuments[storageKey];
    const file: StoredFile = { id: `showcase-file-${fileName}`, organizationId: org, storageKey, sha256: source.sha256, originalName: source.name, contentType: "text/plain", byteLength: new TextEncoder().encode(source.text).length, status: "available", createdAt: day(-30) };
    f.files.push(file);
    return file;
  };
  for (const [invoiceId,fileName] of [["invoice-northline-109","109-invoice-summary.txt"],["invoice-summit-104-compressor","104-compressor-invoice-summary.txt"]]) {
    const file = document(fileName);
    const invoice = f.invoices.find(i => i.id === invoiceId)!;
    invoice.supportingFileId = file.id;
    f.entityFiles = f.entityFiles.filter(e => !(["invoice","invoice_reference"].includes(e.entityType) && e.entityId === invoiceId));
    f.entityFiles.push({id:`showcase-invoice-file-${invoiceId}`,organizationId:org,fileId:file.id,entityType:"invoice",entityId:invoiceId,purpose:"invoice",visibility:"internal",createdAt:file.createdAt});
  }
  // Replace metadata-only placeholders in fresh demo records with readable sample evidence.
  for (const [id, fileName] of [["file-invoice-history-104-4", "104-history-invoice-summary.txt"], ["file-104-service-report", "104-service-report.txt"], ["file-104-warranty", "104-warranty-registration.txt"]]) {
    const existing = f.files.find(file => file.id === id)!;
    const source = showcaseDocuments[`org-northline-demo/showcase-v1/${fileName}`];
    Object.assign(existing, {storageKey:`org-northline-demo/showcase-v1/${fileName}`, originalName:source.name, contentType:"text/plain", byteLength:new TextEncoder().encode(source.text).length, sha256:source.sha256, status:"available"});
  }
  // Equipment library: fictional guides for whole models plus one unit-only note.
  f.equipmentDocuments ??= [];
  for (const [fileName, title, docType, maker, model, assetId] of [
    ["rtu-service-guide.txt", "Rooftop unit service guide (demo)", "manual", "trane", "precedentysc", undefined],
    ["beer-cave-troubleshooting.txt", "Beer cave troubleshooting guide (demo)", "manual", "copeland", "m4fha050", undefined],
    ["ice-machine-wiring-sheet.txt", "Ice machine wiring sheet (demo)", "wiring_diagram", "manitowoc", "iyt0750a", undefined],
    ["104-beer-cave-install-notes.txt", "Store 104 beer cave install notes (demo)", "other", undefined, undefined, "asset-104-beer-cave"],
  ] as const) {
    const file = document(fileName);
    f.equipmentDocuments.push({ id: `showcase-equipment-document-${fileName.replace(/\.txt$/, "")}`, organizationId: org, fileId: file.id, title, docType, manufacturerKey: maker, modelKey: model, assetId, uploadedByMembershipId: facility, uploadedByName: name(facility), createdAt: file.createdAt });
  }
  const callbackFile = document("104-callback-invoice-summary.txt");
  f.invoices.find(i => i.id === "invoice-summit-104-warranty-callback")!.supportingFileId = callbackFile.id;
  f.entityFiles.push({id:"showcase-callback-invoice-file",organizationId:org,fileId:callbackFile.id,entityType:"invoice",entityId:"invoice-summit-104-warranty-callback",purpose:"invoice",visibility:"internal",createdAt:callbackFile.createdAt});
  // No actual photos were supplied for these fictional records; do not advertise missing images.
  const placeholderPhotos = new Set(["file-104-compressor-before", "file-104-compressor-after", "file-109-unmatched-invoice"]);
  f.entityFiles = f.entityFiles.filter(e => !placeholderPhotos.has(e.fileId));
  f.files = f.files.filter(file => !placeholderPhotos.has(file.id));
  const closedWarrantyWorkId = "showcase-warranty-completed-work";
  f.workOrders.push({id:closedWarrantyWorkId,organizationId:org,number:`CPS-${date(0).slice(0,4)}-3201`,storeId:"store-northline-104",assetId:"asset-104-beer-cave",componentId:"component-104-compressor",categoryKey:"refrigeration",problem:"Intermittent compressor connection after replacement",authorizedScope:"Correct the covered connection and verify stable operation.",priority:"routine",status:"closed",version:0,accountableParty:"Facilities",nextAction:"Review completed warranty history",createdAt:day(-18),closedAt:day(-16)});
  const closedWarrantyId = "showcase-warranty-completed";
  f.warrantyCases.push({id:closedWarrantyId,organizationId:org,workOrderId:closedWarrantyWorkId,assetId:"asset-104-beer-cave",componentId:"component-104-compressor",priorRepairItemId:"repair-item-104-compressor-2026-07",appliedWarrantyId:"applied-warranty-104-compressor-labor",status:"closed",confidence:"high",detectionExplanation:"Fictional completed claim: ColdLine confirmed labor coverage, corrected the connection and returned the service note; the store confirmed stable operation.",diagnosisRequired:false,coverageDecision:"covered",customerChargeStatus:"warranty_covered",invoiceHold:false,routingRule:"original_vendor_first_right_to_cure",obligatedVendorId:"vendor-northline-summit",ownerName:name(facility),nextAction:"Review completed warranty history",createdAt:day(-18),closedAt:day(-16)});
  const closedWarrantyFile=document("104-closed-warranty.txt");
  f.entityFiles.push({id:"showcase-closed-warranty-file",organizationId:org,fileId:closedWarrantyFile.id,entityType:"work_order",entityId:closedWarrantyWorkId,purpose:"service_document",visibility:"internal",createdAt:day(-16)});
  audit("warranty_case",closedWarrantyId,"warranty.coverage_decided",day(-17),{coverageDecision:"covered",reason:"Provider confirmed labor coverage for the connection."});
  audit("warranty_case",closedWarrantyId,"warranty.closed",day(-16),{reason:"Service note received; store confirmed stable operation.",workOrderId:closedWarrantyWorkId});
  audit("work_order",closedWarrantyWorkId,"work_order.closed",day(-16),{reason:"Covered correction completed and store confirmation recorded in the attached sample service note."});
  const checklist = document("weekly-walk-checklist.txt");
  const foodReport = document("108-food-inspection.txt");
  const findingReport = document("114-exit-light-finding.txt");
  const permitReport = document("112-permit-confirmation.txt");

  // Reports can arrive before anyone knows the repair price.
  const reportApprovalIds = new Set(f.approvalRequests.filter(a => a.subjectType === "service_request").map(a => a.id));
  f.approvalRequests = f.approvalRequests.filter(a => !reportApprovalIds.has(a.id));
  f.approvalDecisions = f.approvalDecisions.filter(a => !reportApprovalIds.has(a.approvalRequestId));
  f.workflowTasks = f.workflowTasks.filter(t => !t.sourceApprovalRequestId || !reportApprovalIds.has(t.sourceApprovalRequestId));
  for (const [store, problem] of [[103, "Restroom faucet is dripping after closing the handle"], [108, "Stockroom door catches on the floor when fully opened"], [115, "Water is collecting below the prep sink during cleanup"]] as const) {
    const id = `showcase-report-${store}`, storeId = `store-northline-${store}`, reporterName = name(member(store));
    f.requests.push({id,organizationId:org,reference:`REQ-${store}-NEW`,storeId,reporterName,problem,priority:"routine",status:"submitted",version:0,submittedAt:day(-1)});
    f.requestImpactAssessments.push({id:`${id}-impact`,organizationId:org,requestId:id,storeId,assessmentKind:"initial_report",storeOperatingState:"open",safetyConcern:"none_reported",productInventoryRisk:"none_reported",customersAffected:"no",complianceImpact:"none_reported",redundantEquipment:"unknown",confidence:"medium",source:"store_report",notes:"Store remains open; manager review needed.",assessedByActorType:"user",assessedByActorId:member(store),assessedByActorName:reporterName,assessedAt:day(-1)});
    audit("service_request",id,"request.submitted",day(-1),{problem,reporterName});
  }

  // Weekly store walks demonstrate ordinary use, alongside a few compliance exceptions.
  f.complianceSchedules = [];
  f.inspections = [];
  const inspectionStory = (store: number, key: string, title: string, offset: number, status: "pending" | "performed" | "passed" | "action_needed", options: {vendor?: string; document?: StoredFile; note?: string; weekly?: boolean; permit?: boolean} = {}) => {
    const id = `showcase-schedule-${key}`, storeId = `store-northline-${store}`, workId = `showcase-work-${key}`;
    const owner = options.vendor ? f.vendors.find(v => v.id === options.vendor)!.name : name(member(store));
    const finished = status === "passed";
    const createdAt = day(Math.min(-10, offset - 7));
    f.complianceSchedules!.push({ id, organizationId: org, storeId, name: title, instructions: options.weekly ? "Walk the store using the attached checklist. Record findings and upload the completed checklist and any photos." : "Complete the scheduled check, record findings and return the required paperwork. Report any corrective work needed.", requirementSource: "Fictional company inspection program", evidenceLabel: options.permit ? "Renewal confirmation" : "Completed checklist or report", firstDueDate: date(offset), intervalUnit: options.weekly ? "days" : "months", intervalCount: options.weekly ? 7 : 12, leadDays: options.weekly ? 2 : 14, handler: options.vendor ? "vendor" : "internal", vendorId: options.vendor, membershipId: options.vendor ? undefined : member(store), evidenceRequired: 1, escalationDays: 2, escalationTo: "Jordan Lee · Facilities", kind: options.permit ? "permit" : "inspection", status: "active", createdAt, masterDocumentsJson: options.weekly ? JSON.stringify([checklist]) : "[]" });
    f.workOrders.push({ id: workId, organizationId: org, storeId, number: `CPS-${date(0).slice(0,4)}-${3100 + f.inspections!.length}`, problem: title, authorizedScope: options.weekly ? "Complete the weekly walk checklist and return findings and photos." : "Perform the inspection and return the report; identify any corrective work separately.", priority: "routine", status: finished ? "closed" : status === "pending" ? "approved" : "completed_pending_review", version: 0, accountableParty: finished ? "Facilities" : status === "pending" ? owner : "Facilities", nextAction: finished ? "Review inspection history" : status === "pending" ? "Complete inspection and return paperwork" : "Review inspection findings and paperwork", dueAt: finished ? undefined : day(offset), escalationTo: "Facilities director", createdAt, closedAt: finished ? day(offset + 1) : undefined });
    f.assignments.push({ id: `showcase-assignment-${key}`, organizationId: org, workOrderId: workId, kind: options.vendor ? "outside_vendor" : "internal", vendorId: options.vendor, internalMembershipId: options.vendor ? undefined : member(store), status: "accepted", assignedAt: createdAt });
    const inspectionId = `inspection-${id}-${date(offset)}`;
    f.inspections!.push({ id: inspectionId, organizationId: org, scheduleId: id, storeId, dueDate: date(offset), status, workOrderId: workId, version: 0, createdAt, completedAt: status === "pending" ? undefined : day(offset), resultNote: options.note, masterDocumentsJson: options.weekly ? JSON.stringify([checklist]) : "[]", documentExpiresOn: options.permit ? date(21) : undefined });
    if (options.document) f.entityFiles.push({ id: `showcase-evidence-${key}`, organizationId: org, fileId: options.document.id, entityType: "work_order", entityId: workId, purpose: "service_document", visibility: "internal", createdAt: day(offset) });
    audit("work_order", workId, "work_order.created", createdAt, { inspectionId, assignedTo: owner });
    audit("inspection", inspectionId, "inspection.created", createdAt, { scheduleId: id, workOrderId: workId });
    if (status !== "pending") audit("inspection", inspectionId, "inspection.performed", day(offset), { result: options.note });
    if (finished) audit("inspection", inspectionId, "inspection.reviewed", day(offset + 1), { result: "passed", evidenceFileId: options.document?.id });
    return inspectionId;
  };
  for (let store = 101; store <= 115; store++) inspectionStory(store, `walk-${store}`, "Weekly store walk", 1 + (store % 6), "pending", { weekly: true });
  inspectionStory(104, "extinguisher", "Fire extinguisher check", -2, "pending");
  inspectionStory(105, "fuel", "Fuel-system inspection", 12, "pending", { vendor: "vendor-northline-forecourt" });
  inspectionStory(108, "food", "Food-service inspection", -4, "passed", { document: foodReport, note: "Checks passed. Completed report reviewed; no corrective work needed." });
  inspectionStory(110, "paperwork", "Kitchen hood inspection", -1, "performed", { vendor: "vendor-northline-cedar", note: "Inspection completed. Vendor report still needed before review." });
  inspectionStory(112, "permit", "Permit renewal review", -7, "passed", { permit: true, document: permitReport, note: "Renewal confirmation reviewed. Next expiration is approaching." });
  const finding = inspectionStory(114, "safety", "Site safety inspection", -3, "action_needed", { document: findingReport, note: "Rear exit light failed the check. Internal maintenance must repair and verify it." });
  const correctiveId = "showcase-work-exit-light";
  f.workOrders.push({ id: correctiveId, organizationId: org, storeId: "store-northline-114", number: `CPS-${date(0).slice(0,4)}-3199`, problem: "Rear exit light did not illuminate during the store safety check", authorizedScope: "Inspect and repair the rear exit light. Verify operation and return a photo for inspection review.", categoryKey: "electrical", priority: "urgent", status: "accepted", version: 0, accountableParty: "Maria Santos", nextAction: "Repair exit light and return verification", dueAt: day(1), escalationTo: "Jordan Lee", createdAt: day(-2) });
  f.assignments.push({ id: "showcase-assignment-exit-light", organizationId: org, workOrderId: correctiveId, kind: "internal", internalMembershipId: "membership-northline-tech-1", status: "accepted", assignedAt: day(-2) });
  f.inspections.find(i => i.id === finding)!.correctiveWorkOrderId = correctiveId;
  audit("work_order", correctiveId, "work_order.created", day(-2), { inspectionId: finding });

  // Plans include proactive renewal, repeat repairs and a price still to obtain.
  const plans: Array<[number, string, number, number | undefined, string]> = [
    [101, "asset-101-walk-in-freezer", 1, 2450000, "Plan freezer replacement before the holiday peak; keep the current unit operating until installation."],
    [105, "asset-105-rtu-1", 2, 1850000, "Compare the current repair estimate with a planned rooftop replacement."],
    [112, "asset-112-ice-machine", 4, 920000, "Proactive renewal during the quieter trading period; no breakdown is required."],
    [115, "asset-115-beer-cave", 6, 3650000, "Reserve an installation month for the aging unit and coordinate store access."],
    [109, "asset-109-rapid-cook-oven", 0, undefined, "Obtain an installed replacement price before choosing a month."],
  ];
  f.capitalPlans = plans.map(([store, assetId, months, amountMinor, reason]) => {
    const asset = f.assets.find(a => a.id === assetId)!;
    const target = new Date(`${date(0).slice(0,7)}-01T12:00:00Z`); target.setUTCMonth(target.getUTCMonth() + months);
    const plan = { id: `showcase-capital-${store}`, organizationId: org, assetId: asset.id, storeId: asset.storeId, version: 1, targetMonth: months ? target.toISOString().slice(0,7) : undefined, amountMinor, currency: "USD", costBasis: "Planning estimate", priority: "flexible" as const, owner: "Jordan Lee", reason, status: months ? "planned" as const : "considering" as const, createdAt: day(-5) };
    audit("asset", asset.id, "asset.capital_plan_saved", day(-5), { after: plan }); return plan;
  });

  f.storeTasks = []; f.storeTaskPeople = []; f.storeTaskMessages = [];
  const task = (store: number, key: string, title: string, instructions: string, status: StoreTask["status"], extra: Partial<StoreTask> = {}) => {
    const t: StoreTask = { id: `showcase-task-${key}`, organizationId: org, storeId: `store-northline-${store}`, title, instructions, kind: "general", assignment: "local", assigneeId: null, claimantId: status === "open" ? null : member(store), requesterId: facility, fallbackId: `membership-northline-regional-${Math.floor((store-101)/5)+1}`, status, priority: "routine", dueAt: day(1), notifyRequester: 1, workOrderId: null, invoiceId: null, visitId: null, assetId: null, windowsJson: "[]", result: status === "open" ? null : "done", version: status === "open" ? 1 : 3, createdAt: day(-2), updatedAt: status === "open" ? day(-2) : day(-1), ...extra };
    f.storeTasks!.push(t);
    for (const membershipId of new Set([facility, t.fallbackId, t.assigneeId, t.claimantId].filter((id): id is string => !!id))) f.storeTaskPeople!.push({ id: `${t.id}-${membershipId}`, organizationId: org, taskId: t.id, membershipId, seenAt: day(-2) });
    f.storeTaskMessages!.push({ id: `${t.id}-created`, organizationId: org, taskId: t.id, actorId: facility, actorName: name(facility), kind: "created", body: instructions, findingsJson: "[]", createdAt: day(-2) });
    audit("store_task", t.id, "store_task.created", day(-2), { title, assignment: t.assignment });
    return t;
  };
  task(104, "cooler", "Check the beer-cave door after the morning rush", "Check whether the door closes fully and whether frost has returned. Add a photo of the lower hinge if the problem remains.", "open", { kind: "equipment", workOrderId: "wo-service-run-104-reactive", assetId: "asset-104-beer-cave" });
  task(107, "access", "Confirm delivery-door access for the next service visit", "Confirm the best access time and where the technician should park. No repair or invoice is needed for this task.", "open", { assignment: "responsible" });
  task(114, "exit", "Verify the exit light after repair", "After maintenance repairs the light, check operation and attach a photo. Report any remaining issue.", "open", { workOrderId: correctiveId, dueAt: day(2), priority: "urgent" });
  const cameraInvoice = f.invoices.find(i => i.id === "invoice-northline-109")!;
  const cameraDate = cameraInvoice.invoiceDate;
  const camera = task(109, "camera", "Check the visit date on the unmatched invoice", "The invoice gives a date but no service time. Check whether a visit occurred that day at the rear entrance. Record arrival and departure shown on the camera, and whether the work area was visited. The invoice still needs a work-order match.", "review", { kind: "camera", invoiceId: cameraInvoice.id, result: "attention", windowsJson: JSON.stringify([{start:`${cameraDate}T00:00`,end:`${cameraDate}T23:59`,area:"Rear entrance and service area"}]) });
  f.storeTaskMessages!.push({id:`${camera.id}-findings`,organizationId:org,taskId:camera.id,actorId:member(109),actorName:name(member(109)),kind:"complete",body:"Needs attention: A technician was visible, but the billed visit still has no work-order reference. Please confirm the job before finishing invoice review.",findingsJson:JSON.stringify([{start:`${cameraDate}T09:12`,end:`${cameraDate}T10:06`,result:"partial",notes:"Arrival and departure visible; the full work area is outside camera coverage."}]),createdAt:day(-1)});
  const closed = task(102, "walkway", "Confirm the delivery walkway is clear", "Check that the delivery has been moved out of the rear walkway.", "closed", {notifyRequester:0});
  f.storeTaskMessages!.push({id:`${closed.id}-findings`,organizationId:org,taskId:closed.id,actorId:member(102),actorName:name(member(102)),kind:"complete",body:"Done — no issues: Delivery moved and walkway clear.",findingsJson:"[]",createdAt:day(-1)});
  for (const t of [camera, closed]) audit("store_task", t.id, "store_task.complete", day(-1), {status:t.status,result:t.result});

  f.storeVendorPreferences = [104,105,112].map(store => ({id:`showcase-preference-${store}`,organizationId:org,storeId:`store-northline-${store}`,vendorId:"vendor-northline-summit",tradeKeysJson:JSON.stringify(["refrigeration"]),version:1,createdAt:day(-20)}));
  for (const work of f.workOrders.filter(w => w.id.startsWith("showcase-") && w.status !== "closed")) {
    const assignment = f.assignments.find(a => a.workOrderId === work.id)!;
    const awaitingReview = work.status === "completed_pending_review";
    f.workflowTasks.push({id:`showcase-flow-${work.id}`,organizationId:org,workOrderId:work.id,taskType:awaitingReview?"verify_repair":"other",title:work.nextAction,reason:work.problem,assigneeType:awaitingReview?"user":assignment.vendorId?"vendor":"user",assigneeId:awaitingReview?facility:assignment.vendorId??assignment.internalMembershipId,assigneeName:work.accountableParty,priority:work.priority==="urgent"?"high":"normal",status:"open",blocking:true,requiredForProgress:true,dueAt:work.dueAt,completionCriteria:awaitingReview?"Review findings and required evidence.":"Record the outcome and required evidence.",escalationDestination:work.escalationTo!,escalationLevel:0,createdByActorType:"user",createdByActorId:facility,createdByActorName:name(facility),createdAt:work.createdAt});
  }
  const dispatchExamples = [
    { key: "maria", store: 101, target: "person" as const, technician: "membership-northline-tech-1", problem: "Restroom faucet drips after closing.", held: false },
    { key: "devon", store: 106, target: "person" as const, technician: "membership-northline-tech-2", problem: "Stockroom door closer needs adjustment.", held: false },
    { key: "pool", store: 111, target: "pool" as const, technician: undefined, problem: "Parking lot sign bracket is loose.", held: false },
    { key: "manager", store: 104, target: "awaiting_allocation" as const, technician: undefined, problem: "Coordinate replacement of a damaged cooler door handle.", held: false },
    { key: "next-visit", store: 108, target: "pool" as const, technician: undefined, problem: "Tighten the stockroom shelf bracket on the next suitable visit.", held: true },
  ];
  dispatchExamples.forEach((example, index) => {
    const workId = `dispatch-demo-${example.key}`;
    const owner = "membership-northline-field-manager";
    const who = example.technician ? name(example.technician) : name(owner);
    const nextAction = example.held ? "Wait for a suitable internal visit" : example.target === "person" ? "Begin internal work" : example.target === "pool" ? "Arrange team pickup" : "Arrange internal work";
    const dueAt = day(example.held ? 14 : 3);
    f.workOrders.push({ id: workId, organizationId: org, number: `CPS-2026-${String(301+index).padStart(4,"0")}`, storeId: `store-northline-${example.store}`, problem: example.problem, priority: "routine", status: "approved", version: 0, internalAccountableType: "membership", internalAccountableId: owner, internalAccountableParty: name(owner), accountableParty: example.held ? name(owner) : who, nextAction, dueAt, escalationTo: "Facilities leadership", createdAt: day(-1) });
    f.assignments.push({ id: `${workId}-assignment`, organizationId: org, workOrderId: workId, kind: "internal", internalTarget: example.target, internalMembershipId: example.technician, status: "pending", assignedAt: day(-1) });
    f.workflowTasks.push({ id: `${workId}-task`, organizationId: org, workOrderId: workId, taskType: "other", title: nextAction, reason: example.problem, assigneeType: "user", assigneeId: example.held ? owner : example.technician ?? owner, assigneeName: example.held ? name(owner) : who, priority: "normal", status: "open", blocking: true, requiredForProgress: true, dueAt, completionCriteria: "Arrange internal service and record its outcome", escalationDestination: "Facilities leadership", escalationLevel: 0, createdByActorType: "user", createdByActorId: facility, createdByActorName: name(facility), createdAt: day(-1) });
    if (example.held) (f.workOrderVisitHolds ??= []).push({ id: `${workId}-hold`, organizationId: org, workOrderId: workId, posture: "complete_using_professional_judgment", status: "active", deadlineAt: dueAt, version: 0, createdByMembershipId: facility, createdByName: name(facility), createdAt: day(-1), updatedAt: day(-1) });
    audit("work_order",workId,"internal_dispatch.seeded",day(-1),{ internalTarget: example.target, meaning: "fictional_example" });
  });
  audit("organization",org,"showcase.refreshed",f.asOf,{version:"2026-09-29",stores:f.stores.length,inspections:f.inspections!.length,tasks:f.storeTasks!.length,capitalPlans:f.capitalPlans!.length});
  return f;
}
