import {
  addHeldWorkToActiveVisit,
  attachPublicEvidence,
  checkInVisitWithCheckoutToken,
  checkOutVisit,
  createServiceRequest,
  markServiceAuthorizationOpened,
  OpsDomainError,
  recordVendorResponse,
} from "@/lib/ops/commands";
import { NORTHLINE_DEMO_ENTRY_TOKENS } from "@/lib/ops/fixtures";
import {
  declineEstimate,
  markEstimateOpened,
  submitEstimate,
} from "@/lib/ops/estimate-commands";
import type { OpsRepository } from "@/lib/ops/repository";
import { vendorFacingScope } from "@/lib/ops/public-visibility";
import { siteVisitOutcomeFromLegacy, siteVisitOutcomeRequiresFollowUp } from "@/lib/ops/site-visit-outcomes";
import { heldWorkVendorEligibility } from "@/lib/ops/held-work-policy";
import { getServerOpsRepositoryProxy } from "@/lib/server/ops-repository-provider";
import type { ActorContext, LocationObservation, ServiceRequest, SiteVisitWorkOrderOutcome, Store, VendorResponseKind, VisitChannel, VisitOutcome as OpsVisitOutcome, VisitSession } from "@/lib/ops/types";
import type {
  ActiveVisitView as OpsActiveVisitView,
  PublicStoreGatewayView,
  ServiceAuthorizationView as OpsServiceAuthorizationView,
  TrustedStoreDeviceView,
} from "@/lib/ops/view-models";
import type {
  ActiveVisitView,
  EligibleWorkOrderView,
  LocationEvidenceInput,
  LocationEvidenceReceipt,
  PerWorkOrderVisitOutcome,
  PublicOperationsGateway,
  PublicUpload,
  ServiceAuthorizationView,
  StoreIssueReceipt,
  StorePortalView,
  TechnicianCheckInReceipt,
  TechnicianCheckOutReceipt,
  VisitWorkOrderView,
  VendorEstimateView,
  VendorVisitContextView,
  VisitOutcome,
  WorkOrderVisitOutcome,
} from "./contracts";
import { PublicWorkflowError } from "./contracts";
import { getPublicUploadStore } from "./server-file-store";

export const PUBLIC_DEMO_LINKS = {
  serviceToken: NORTHLINE_DEMO_ENTRY_TOKENS.serviceAuthorization104,
  storeToken: NORTHLINE_DEMO_ENTRY_TOKENS.store104,
  activeVisitToken: NORTHLINE_DEMO_ENTRY_TOKENS.activeVisit112,
  trustedStoreToken: NORTHLINE_DEMO_ENTRY_TOKENS.trustedStore104,
  estimate105SummitToken: NORTHLINE_DEMO_ENTRY_TOKENS.estimate105Summit,
  estimate105CedarToken: NORTHLINE_DEMO_ENTRY_TOKENS.estimate105Cedar,
} as const;

type PublicAccess =
  | {
      kind: "store";
      tokenHash: string;
      channel: "qr";
      storeGateway: PublicStoreGatewayView;
    }
  | {
      kind: "service";
      tokenHash: string;
      channel: "secure_link";
      serviceAuthorization: OpsServiceAuthorizationView;
      storeRecord: Store;
    }
  | {
      kind: "trusted_store";
      tokenHash: string;
      channel: "store_device";
      trustedStore: TrustedStoreDeviceView;
      storeRecord: Store;
      approvedVendors: Array<{ id: string; name: string; specialties: string[] }>;
    }
  | {
      kind: "visit";
      tokenHash: string;
      channel: "secure_link";
      activeVisit: OpsActiveVisitView;
      organizationName: string;
      storeRecord: Store;
    };

function runtime(): { repository: OpsRepository; mode: "demo" } {
  return { repository: getServerOpsRepositoryProxy(), mode: "demo" };
}

function now(): string {
  return new Date().toISOString();
}

function assertOpaqueToken(token: string): void {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) {
    throw new PublicWorkflowError("This secure link is invalid or incomplete.", 403, "invalid_token");
  }
}

async function hashOpaqueToken(token: string): Promise<string> {
  assertOpaqueToken(token);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const CHECKOUT_TOKEN_NAMESPACE = "ops-checkout-v1";
const LEGACY_CHECKOUT_TOKEN_NAMESPACE = "traceops-checkout-v1";

async function stableCheckoutToken(
  accessToken: string,
  submissionKey: string,
  namespace = CHECKOUT_TOKEN_NAMESPACE,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${namespace}\u0000${accessToken}\u0000${submissionKey}`),
  );
  return base64Url(new Uint8Array(digest));
}

const PUBLIC_CHECK_IN_COMMAND = "public_technician_check_in";
const PUBLIC_CHECK_OUT_COMMAND = "public_technician_check_out";
const PUBLIC_ADD_HELD_WORK_COMMAND = "public_add_held_work_to_visit";
const PUBLIC_STORE_ISSUE_COMMAND = "public_store_issue_report";
const PUBLIC_IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,120}$/;

function cleanSubmissionKey(value: string): string {
  const cleaned = value.trim();
  if (!SUBMISSION_KEY_PATTERN.test(cleaned)) {
    throw new PublicWorkflowError("This action needs a valid retry key. Refresh and try again.", 422, "invalid_idempotency_key");
  }
  return cleaned;
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

async function hashRequest(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashUpload(upload: PublicUpload): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", upload.bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function idempotencyExpiresAt(): string {
  return new Date(Date.now() + PUBLIC_IDEMPOTENCY_TTL_MS).toISOString();
}

async function idempotentVisitResult(input: {
  repository: OpsRepository;
  organizationId: string;
  submissionKey: string;
  command: string;
  requestHash: string;
}): Promise<VisitSession | null> {
  const record = await input.repository.getIdempotencyKey(input.organizationId, input.submissionKey);
  if (!record) return null;
  if (record.command !== input.command || record.requestHash !== input.requestHash) {
    throw new PublicWorkflowError(
      "This retry key was already used for different visit details. Go back and submit the updated action again.",
      409,
      "idempotency_conflict",
    );
  }
  if (record.expiresAt <= now()) {
    throw new PublicWorkflowError("This action's retry window has expired. Go back and submit it again.", 409, "idempotency_expired");
  }
  const visit = await input.repository.getVisit(input.organizationId, record.resultId);
  if (!visit) throw new PublicWorkflowError("The prior visit receipt could not be loaded.", 409, "idempotency_result_unavailable");
  return visit;
}

async function idempotentServiceRequestResult(input: {
  repository: OpsRepository;
  organizationId: string;
  submissionKey: string;
  requestHash: string;
}): Promise<ServiceRequest | null> {
  const record = await input.repository.getIdempotencyKey(input.organizationId, input.submissionKey);
  if (!record) return null;
  if (record.command !== PUBLIC_STORE_ISSUE_COMMAND || record.requestHash !== input.requestHash) {
    throw new PublicWorkflowError(
      "This retry key was already used for a different issue report. Go back before submitting edited details.",
      409,
      "idempotency_conflict",
    );
  }
  if (record.expiresAt <= now()) {
    throw new PublicWorkflowError("This issue report's retry window has expired. Go back and submit it again.", 409, "idempotency_expired");
  }
  const request = await input.repository.getRequest(input.organizationId, record.resultId);
  if (!request) throw new PublicWorkflowError("The prior issue receipt could not be loaded.", 409, "idempotency_result_unavailable");
  return request;
}

function cleanRequired(value: string, field: string, max: number): string {
  const cleaned = value.trim();
  if (!cleaned) throw new PublicWorkflowError(`${field} is required.`, 422, "missing_field");
  if (cleaned.length > max) throw new PublicWorkflowError(`${field} is too long.`, 422, "field_too_long");
  return cleaned;
}

function cleanOptional(value: string | undefined, max: number): string | undefined {
  const cleaned = value?.trim();
  if (!cleaned) return undefined;
  if (cleaned.length > max) throw new PublicWorkflowError("One of the entries is too long.", 422, "field_too_long");
  return cleaned;
}

function publicDomainError(error: unknown): never {
  if (error instanceof PublicWorkflowError) throw error;
  if (error instanceof OpsDomainError) {
    const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 422;
    throw new PublicWorkflowError(error.message, status, error.code.toLowerCase());
  }
  throw error;
}

async function resolveServiceAuthorization(token: string): Promise<{ tokenHash: string; view: OpsServiceAuthorizationView } | null> {
  const tokenHash = await hashOpaqueToken(token);
  const view = await runtime().repository.getServiceAuthorizationByToken({
    tokenHash,
    purpose: "service_authorization",
    now: now(),
  });
  return view ? { tokenHash, view } : null;
}

async function resolveVendorEstimate(token: string) {
  const tokenHash = await hashOpaqueToken(token);
  const repository = runtime().repository;
  const capability = await repository.getEstimateRequestByPublicToken({
    tokenHash,
    purpose: "vendor_estimate",
    now: now(),
  });
  if (!capability) return null;
  const estimateRequest = capability.request;
  const [workOrder, vendor, organization] = await Promise.all([
    repository.getWorkOrder(estimateRequest.organizationId, estimateRequest.workOrderId),
    repository.getVendor(estimateRequest.organizationId, estimateRequest.vendorId),
    repository.getOrganization(estimateRequest.organizationId),
  ]);
  if (!workOrder || !vendor || !organization) return null;
  if (["closed", "cancelled"].includes(workOrder.status)) return null;
  const store = await repository.getStore(estimateRequest.organizationId, workOrder.storeId);
  if (!store) return null;
  return { tokenHash, capability, estimateRequest, workOrder, vendor, organization, store };
}

async function resolvePublicAccess(token: string): Promise<PublicAccess | null> {
  const tokenHash = await hashOpaqueToken(token);
  const repository = runtime().repository;
  const storeGateway = await repository.getPublicStoreGatewayByToken({
    tokenHash,
    purpose: "store_gateway",
    now: now(),
  });
  if (storeGateway) return { kind: "store", tokenHash, channel: "qr", storeGateway };
  const trustedStore = await repository.getTrustedStoreDeviceByToken({
    tokenHash,
    purpose: "trusted_store_device",
    now: now(),
  });
  if (trustedStore) {
    const storeRecord = await repository.getStore(trustedStore.organizationId, trustedStore.store.id);
    if (!storeRecord) return null;
    const vendorRows = (await repository.listVendors(
      { organizationId: trustedStore.organizationId, storeIds: [trustedStore.store.id] },
      "",
      { limit: 100 },
    )).items.filter((vendor) => vendor.status === "approved");
    const approvedVendors = (await Promise.all(vendorRows.map(async (vendor) => (
      await repository.vendorCoversStore(trustedStore.organizationId, vendor.id, trustedStore.store.id)
        ? { id: vendor.id, name: vendor.name, specialties: vendor.specialties }
        : null
    )))).filter((vendor): vendor is { id: string; name: string; specialties: string[] } => Boolean(vendor));
    return { kind: "trusted_store", tokenHash, channel: "store_device", trustedStore, storeRecord, approvedVendors };
  }
  const serviceAuthorization = await repository.getServiceAuthorizationByToken({
    tokenHash,
    purpose: "service_authorization",
    now: now(),
  });
  if (serviceAuthorization) {
    const storeRecord = await repository.getStore(serviceAuthorization.organizationId, serviceAuthorization.store.id);
    return storeRecord ? { kind: "service", tokenHash, channel: "secure_link", serviceAuthorization, storeRecord } : null;
  }
  const activeVisit = await repository.getActiveVisitByToken({
    tokenHash,
    purpose: "active_visit",
    now: now(),
  });
  if (!activeVisit) return null;
  const storeRecord = await repository.getStore(activeVisit.organizationId, activeVisit.storeId);
  const organization = await repository.getOrganization(activeVisit.organizationId);
  return storeRecord && organization
    ? { kind: "visit", tokenHash, channel: "secure_link", activeVisit, organizationName: organization.name, storeRecord }
    : null;
}

function accessOrganizationId(access: PublicAccess): string {
  return access.kind === "store"
    ? access.storeGateway.organizationId
    : access.kind === "trusted_store"
      ? access.trustedStore.organizationId
    : access.kind === "service"
      ? access.serviceAuthorization.organizationId
      : access.activeVisit.organizationId;
}

function accessOrganizationName(access: PublicAccess): string {
  return access.kind === "store"
    ? access.storeGateway.organizationName
    : access.kind === "trusted_store"
      ? access.trustedStore.organizationName
      : access.kind === "service"
        ? access.serviceAuthorization.organizationName
        : access.organizationName;
}

function accessStore(access: PublicAccess) {
  if (access.kind === "store") return access.storeGateway.store;
  if (access.kind === "trusted_store") return access.trustedStore.store;
  if (access.kind === "service") return access.serviceAuthorization.store;
  return {
    id: access.storeRecord.id,
    storeNumber: access.storeRecord.storeNumber,
    name: access.storeRecord.name,
    formattedAddress: [
      access.storeRecord.address1,
      access.storeRecord.address2,
      `${access.storeRecord.city}, ${access.storeRecord.state} ${access.storeRecord.postalCode}`,
    ].filter(Boolean).join(", "),
    timeZone: access.storeRecord.timeZone,
  };
}

function accessVendors(access: PublicAccess): Array<{ id: string; name: string; specialties: string[] }> {
  if (access.kind === "store") return access.storeGateway.approvedVendors;
  if (access.kind === "trusted_store") return access.approvedVendors;
  if (access.kind === "service") {
    return [{ id: access.serviceAuthorization.vendor.id, name: access.serviceAuthorization.vendor.name, specialties: [access.serviceAuthorization.categoryKey ?? "Assigned service"] }];
  }
  return [{ id: access.activeVisit.vendorId, name: access.activeVisit.vendorName, specialties: ["Active visit checkout"] }];
}

function portalFromAccess(access: PublicAccess): StorePortalView {
  const sourceStore = accessStore(access);
  return {
    organizationName: accessOrganizationName(access),
    trustedStoreDevice: access.kind === "trusted_store",
    store: {
      number: sourceStore.storeNumber,
      name: sourceStore.name,
      address: sourceStore.formattedAddress,
      timeZone: sourceStore.timeZone,
    },
    vendors: accessVendors(access).map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      specialties: vendor.specialties.join(" · "),
    })),
    locationPolicy: {
      enabled: access.kind === "trusted_store"
        ? false
        : access.kind === "store"
          ? access.storeGateway.store.locationPolicyEnabled
          : access.storeRecord.locationPolicyEnabled,
      explanation: access.kind === "trusted_store"
        ? "This trusted store computer records the exact visit time and displays it in the store's local timezone. No PIN or location permission is needed."
        : "Location is requested only when a technician checks in or out. The service does not track anyone continuously.",
    },
    capabilities: {
      reportIssue: access.kind === "trusted_store" || (access.kind === "store" && access.storeGateway.actions.includes("report_issue")),
      startVisit: access.kind === "store" || access.kind === "trusted_store" || access.kind === "service",
      finishVisit: access.kind === "trusted_store" || access.kind === "visit",
    },
    visitChannel: access.channel,
    mode: runtime().mode,
  };
}

function titleCase(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayPriority(value: string): "Routine" | "Priority" | "Emergency" {
  return value === "emergency" ? "Emergency" : value === "urgent" ? "Priority" : "Routine";
}

function estimateMoneyLabel(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100);
}

function responseStatus(view: OpsServiceAuthorizationView): ServiceAuthorizationView["status"] {
  return view.latestResponse?.response === "accepted"
    ? "accepted"
    : view.latestResponse?.response === "declined"
      ? "declined"
      : view.latestResponse?.response === "proposed_date"
        ? "date_proposed"
        : view.latestResponse?.response === "question"
          ? "question_received"
          : "awaiting_response";
}

function responseLabel(response: VendorResponseKind): string {
  return {
    accepted: "Work accepted",
    declined: "Work declined",
    proposed_date: "Arrival date proposed",
    question: "Question received",
  }[response];
}

function locationResultLabel(value: string, storeNumber: string): string {
  return {
    verified: `Location verified near Store ${storeNumber}`,
    outside_geofence: `Location captured outside the Store ${storeNumber} area`,
    low_accuracy: "Location captured with low accuracy",
    permission_denied: "Location permission declined",
    unavailable: "Device location unavailable",
    not_requested: "Location was not requested",
    trusted_store_device: "Recorded on a trusted store device",
  }[value] ?? "Location result unavailable";
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(store: Store, latitude: number, longitude: number): number {
  const storeLatitude = store.latitudeE6! / 1_000_000;
  const storeLongitude = store.longitudeE6! / 1_000_000;
  const latitudeDelta = degreesToRadians(storeLatitude - latitude);
  const longitudeDelta = degreesToRadians(storeLongitude - longitude);
  const startLatitude = degreesToRadians(latitude);
  const endLatitude = degreesToRadians(storeLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function evaluateLocation(store: Store, input: LocationEvidenceInput): { observation: LocationObservation; receipt: LocationEvidenceReceipt } {
  const recordedAt = input.capturedAt ?? now();
  if (input.captureResult !== "captured") {
    const result = input.captureResult === "permission_denied"
      ? "permission_denied"
      : input.captureResult === "not_requested"
        ? "not_requested"
        : "unavailable";
    const receiptState = input.captureResult;
    const label = {
      permission_denied: "Location permission declined",
      position_unavailable: "Device location unavailable",
      timeout: "Location request timed out",
      unsupported: "Location is not supported on this device",
      not_requested: "Location was not requested by this operator",
    }[input.captureResult];
    return {
      observation: { result, capturedAt: recordedAt },
      receipt: { state: receiptState, label },
    };
  }
  if (input.latitude === undefined || input.longitude === undefined || input.accuracyM === undefined || !input.capturedAt) {
    throw new PublicWorkflowError("The device returned incomplete location evidence.", 422, "invalid_location");
  }
  if (store.latitudeE6 === undefined || store.longitudeE6 === undefined) {
    return {
      observation: { result: "unavailable", capturedAt: input.capturedAt },
      receipt: { state: "position_unavailable", label: "This store does not have a location configured" },
    };
  }
  const accuracyM = Math.round(input.accuracyM);
  const distanceM = Math.round(distanceMeters(store, input.latitude, input.longitude));
  const common = {
    latitudeE6: Math.round(input.latitude * 1_000_000),
    longitudeE6: Math.round(input.longitude * 1_000_000),
    accuracyM,
    distanceM,
    capturedAt: input.capturedAt,
  };
  if (accuracyM > 150) {
    return {
      observation: { result: "low_accuracy", ...common },
      receipt: { state: "accuracy_too_low", label: `Location captured, but accuracy was too low (${accuracyM} m)`, accuracyM, distanceM, capturedAt: input.capturedAt },
    };
  }
  if (distanceM > store.geofenceRadiusM + accuracyM) {
    return {
      observation: { result: "outside_geofence", ...common },
      receipt: { state: "outside_store_area", label: `Location captured outside the Store ${store.storeNumber} area (${distanceM} m away)`, accuracyM, distanceM, capturedAt: input.capturedAt },
    };
  }
  return {
    observation: { result: "verified", ...common },
    receipt: { state: "verified_near_store", label: `Location verified near Store ${store.storeNumber} (${distanceM} m away)`, accuracyM, distanceM, capturedAt: input.capturedAt },
  };
}

function trustedStoreLocation(recordedAt: string = now()): { observation: LocationObservation; receipt: LocationEvidenceReceipt } {
  const capturedAt = recordedAt;
  return {
    observation: { result: "trusted_store_device", capturedAt },
    receipt: {
      state: "not_requested",
      label: "Recorded on this trusted store device",
      capturedAt,
    },
  };
}

const ELIGIBLE_VISIT_WORK_STATUSES = [
  "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts",
] as const;
const ELIGIBLE_VISIT_ASSIGNMENT_STATUSES = new Set(["issued", "opened", "accepted"]);

async function publicWorkOrdersForVisit(
  repository: OpsRepository,
  organizationId: string,
  visit: Pick<VisitSession, "id" | "workOrderId">,
): Promise<VisitWorkOrderView[]> {
  const links = await repository.listSiteVisitWorkOrders(organizationId, visit.id);
  const workOrderIds = links.length ? links.map((link) => link.workOrderId) : visit.workOrderId ? [visit.workOrderId] : [];
  const workOrders = await Promise.all(workOrderIds.map((workOrderId) => repository.getWorkOrder(organizationId, workOrderId)));
  return (await Promise.all(workOrders.filter((workOrder): workOrder is NonNullable<typeof workOrder> => Boolean(workOrder)).map(async (workOrder) => {
    const link = links.find((candidate) => candidate.workOrderId === workOrder.id);
    const hold = link?.workOrderHoldId ? await repository.getWorkOrderVisitHold(organizationId, workOrder.id) : null;
    return { id: workOrder.id, number: workOrder.number, problem: workOrder.problem, selectionSource: link?.selectionSource, heldWorkPosture: hold?.posture };
  })));
}

async function getContextFromAccess(access: PublicAccess, requestedVendorId?: string): Promise<VendorVisitContextView> {
  const repository = runtime().repository;
  const vendors = accessVendors(access);
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  if (requestedVendorId && !vendorById.has(requestedVendorId)) {
    throw new PublicWorkflowError("Choose an approved vendor from this store's list.", 403, "vendor_not_available");
  }
  const store = accessStore(access);
  const organizationId = accessOrganizationId(access);
  const scope = { organizationId, storeIds: [store.id] };
  const sourceWork = access.kind === "service"
    ? [{
        id: access.serviceAuthorization.workOrderId,
        number: access.serviceAuthorization.workOrderNumber,
        problem: access.serviceAuthorization.problem,
        categoryKey: access.serviceAuthorization.categoryKey,
        priority: access.serviceAuthorization.priority,
        vendorId: access.serviceAuthorization.vendor.id,
        vendorName: access.serviceAuthorization.vendor.name,
        assignmentKind: "outside_vendor" as const,
        assignmentStatus: access.serviceAuthorization.assignmentStatus,
        dueAt: undefined,
        createdAt: access.serviceAuthorization.issuedAt,
      }]
    : access.kind === "store" || access.kind === "trusted_store"
      ? (await repository.listWorkOrders(scope, {
          statuses: [...ELIGIBLE_VISIT_WORK_STATUSES],
          limit: 100,
        })).items
      : [];

  const eligibleSource = sourceWork.filter((work) => (
    work.assignmentKind === "outside_vendor"
    && Boolean(work.vendorId)
    && vendorById.has(work.vendorId!)
    && (!requestedVendorId || work.vendorId === requestedVendorId)
    && Boolean(work.assignmentStatus && ELIGIBLE_VISIT_ASSIGNMENT_STATUSES.has(work.assignmentStatus))
  ));
  const eligibleWorkOrderBase = (await Promise.all(eligibleSource.map(async (work): Promise<EligibleWorkOrderView | null> => {
    const [record, detail, assignment, issuance] = await Promise.all([
      repository.getWorkOrder(organizationId, work.id),
      repository.getWorkOrderDetail(scope, work.id),
      repository.getActiveAssignment(organizationId, work.id),
      repository.getLatestIssuanceForWorkOrder(organizationId, work.id),
    ]);
    if (!record || !assignment || assignment.kind !== "outside_vendor" || assignment.vendorId !== work.vendorId) return null;
    const [taxonomy, response] = await Promise.all([
      record.taxonomyNodeId ? repository.getTaxonomyNode(organizationId, record.taxonomyNodeId) : null,
      repository.getLatestVendorResponse(organizationId, assignment.id),
    ]);
    const scheduledAt = response?.proposedAt;
    return {
      id: work.id,
      number: work.number,
      priority: displayPriority(work.priority),
      problem: work.problem,
      area: taxonomy?.name,
      category: titleCase(work.categoryKey),
      asset: detail?.asset ? `${detail.asset.name} · ${detail.asset.assetTag}` : undefined,
      dueOrScheduledAt: scheduledAt ?? record.dueAt,
      dueOrScheduledLabel: scheduledAt ? "Proposed arrival" : record.dueAt ? "Due" : undefined,
      assignedVendor: { id: work.vendorId!, name: work.vendorName ?? vendorById.get(work.vendorId!)!.name },
      issuedAt: issuance?.issuedAt ?? work.createdAt,
    };
  }))).filter((work): work is EligibleWorkOrderView => Boolean(work));
  const runVendorIds = requestedVendorId ? [requestedVendorId] : [...new Set(eligibleWorkOrderBase.map((work) => work.assignedVendor.id))];
  const plannedServiceRuns = (await Promise.all(runVendorIds.map(async (vendorId) => {
    const runs = await repository.listServiceRunsForStoreVendor(organizationId, store.id, vendorId);
    return (await Promise.all(runs.filter((run) => ["accepted", "committed", "in_progress"].includes(run.status)).map(async (run) => {
      const [stops, work] = await Promise.all([
        repository.listRouteStops(organizationId, run.id),
        repository.listServiceRunWorkOrders(organizationId, run.id),
      ]);
      const stop = stops.find((candidate) => candidate.storeId === store.id && ["planned", "arrived"].includes(candidate.status));
      if (!stop) return null;
      return {
        id: run.id, startsAt: run.committedStartsAt ?? run.proposedStartsAt, status: run.status,
        stopSequence: stop.sequence,
        plannedWorkOrderIds: work.filter((link) => link.routeStopId === stop.id && link.planned).map((link) => link.workOrderId),
        removalReasonRequired: true as const,
      };
    }))).filter((run): run is NonNullable<typeof run> => Boolean(run));
  }))).flat();
  const plannedByWorkOrder = new Map(plannedServiceRuns.flatMap((run) => run.plannedWorkOrderIds.map((workOrderId) => [workOrderId, run] as const)));
  const eligibleWorkOrders = eligibleWorkOrderBase.map((workOrder) => {
    const run = plannedByWorkOrder.get(workOrder.id);
    return run ? { ...workOrder, plannedServiceRun: { id: run.id, startsAt: run.startsAt, stopSequence: run.stopSequence } } : workOrder;
  });
  const heldVendorId = requestedVendorId ?? (access.kind === "visit" ? access.activeVisit.vendorId : undefined);
  const heldWork = heldVendorId && access.kind !== "service"
    ? (await Promise.all((await repository.listActiveWorkOrderVisitHoldsForStore(organizationId, store.id)).map(async (hold) => {
        const workOrder = await repository.getWorkOrder(organizationId, hold.workOrderId);
        if (!workOrder || workOrder.status !== "approved") return null;
        const eligibility = await heldWorkVendorEligibility({ repository, organizationId, vendorId: heldVendorId, workOrder, now: now() });
        if (!eligibility.allowed) return null;
        const detail = await repository.getWorkOrderDetail(scope, workOrder.id);
        const disclosures = detail?.asset
          ? [
              `Equipment: ${detail.asset.name} · ${detail.asset.assetTag}`,
              ...(detail.asset.warrantyEndsAt && detail.asset.warrantyEndsAt > now()
                ? [`Warranty record through ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: store.timeZone }).format(new Date(detail.asset.warrantyEndsAt))}; preserve any manufacturer service requirements.`]
                : []),
            ]
          : [];
        return {
          id: workOrder.id,
          holdId: hold.id,
          number: workOrder.number,
          problem: workOrder.problem,
          category: titleCase(workOrder.categoryKey) ?? "Service",
          asset: detail?.asset ? `${detail.asset.name} · ${detail.asset.assetTag}` : undefined,
          deadlineAt: hold.deadlineAt,
          posture: hold.posture,
          instruction: hold.posture === "look_and_report" ? "Look and report back" : "Complete using professional judgment",
          disclosures,
        };
      }))).filter((row): row is NonNullable<typeof row> => Boolean(row))
    : [];

  // Generic QR and service links never disclose active-visit identifiers. A
  // visit capability discloses only itself. A trusted device is already bound
  // by repository lookup to exactly one store and may list that store's visits.
  const activeSources = access.kind === "visit"
    ? [access.activeVisit]
    : access.kind === "trusted_store"
      ? access.trustedStore.activeVisits.filter((visit) => (
          visit.providerKind === "outside_vendor"
          && Boolean(visit.vendorId)
          && (!requestedVendorId || visit.vendorId === requestedVendorId)
        ))
      : [];
  const activeVisits = (await Promise.all(activeSources.map(async (source): Promise<ActiveVisitView | null> => {
    const visit = await repository.getVisit(organizationId, source.id);
    if (!visit || visit.storeId !== store.id || visit.providerKind !== "outside_vendor" || !visit.vendorId) return null;
    if (requestedVendorId && visit.vendorId !== requestedVendorId) return null;
    const workOrders = await publicWorkOrdersForVisit(repository, organizationId, visit);
    return {
      id: visit.id,
      technicianName: visit.technicianName,
      vendorName: visit.providerName,
      workOrders,
      workOrderNumber: workOrders.length === 1 ? workOrders[0]!.number : undefined,
      noWorkOrderReason: visit.unmatchedReason,
      checkedInAt: visit.checkedInAt,
      crewCount: visit.crewCount ?? 1,
      additionalTechnicianNames: visit.additionalTechnicianNames ?? [],
      vehicleIdentifier: visit.vehicleIdentifier,
      arrivalNote: visit.arrivalNote,
      startedVia: visit.startedChannel,
      checkInLocationLabel: access.kind === "visit"
        ? locationResultLabel(access.activeVisit.checkInLocationResult, store.storeNumber)
        : visit.startedChannel === "store_device"
          ? "Recorded on a trusted store device"
          : "Original check-in evidence is preserved with this visit",
    };
  }))).filter((visit): visit is ActiveVisitView => Boolean(visit));

  const narrowedVendorId = requestedVendorId
    ?? (access.kind === "service" ? access.serviceAuthorization.vendor.id : access.kind === "visit" ? access.activeVisit.vendorId : undefined);
  return {
    vendorId: narrowedVendorId,
    vendorName: narrowedVendorId ? vendorById.get(narrowedVendorId)?.name : undefined,
    workOrderSelectionBound: access.kind === "service",
    eligibleWorkOrders,
    heldWork,
    plannedServiceRuns,
    activeVisits,
  };
}

function followUpForOutcome(outcome: VisitOutcome, providerName: string): { accountableParty: string; nextAction: string; dueAt: string; escalationTo: string } | undefined {
  if (outcome === "resolved") return undefined;
  const facilitiesOwned = outcome === "unable_to_complete" || outcome === "unable_to_reproduce" || outcome === "other";
  return {
    accountableParty: facilitiesOwned ? "Facilities coordinator" : providerName,
    nextAction: outcome === "diagnosed_waiting_parts"
      ? "Provide parts ETA and schedule the return visit"
      : outcome === "temporary_repair"
        ? "Review permanent repair plan and schedule follow-up"
        : outcome === "return_required"
          ? "Schedule the required return visit"
          : outcome === "unable_to_reproduce"
            ? "Review the unable-to-reproduce outcome and decide whether to monitor, reassign, or close"
          : "Review the visit outcome and choose the next action",
    dueAt: new Date(Date.now() + (facilitiesOwned ? 4 : 24) * 60 * 60 * 1000).toISOString(),
    escalationTo: "Facilities director",
  };
}

function followUpForWorkOrderOutcome(outcome: WorkOrderVisitOutcome, providerName: string): { accountableParty: string; nextAction: string; dueAt: string; escalationTo: string } | undefined {
  if (!siteVisitOutcomeRequiresFollowUp(outcome)) return undefined;
  const facilitiesOwned = outcome === "no_issue_found" || outcome === "store_access_unavailable" || outcome === "work_not_authorized" || outcome === "not_addressed";
  const nextAction: Record<Exclude<WorkOrderVisitOutcome, "completed" | "no_issue_found">, string> = {
    temporary_repair: "Review the temporary repair and plan permanent work",
    diagnosis_only: "Review the diagnosis and confirm the next service step",
    quote_required: "Provide the requested quote for operator review",
    parts_required: "Provide the parts ETA and proposed return date",
    return_visit_required: "Propose the return service date",
    store_access_unavailable: "Review the access issue and coordinate a workable return",
    work_not_authorized: "Review the additional work and decide whether to authorize it",
    not_addressed: "Review why the work was not completed and choose the next action",
  };
  return {
    accountableParty: facilitiesOwned ? "Facilities coordinator" : providerName,
    nextAction: nextAction[outcome as Exclude<WorkOrderVisitOutcome, "completed" | "no_issue_found">],
    dueAt: new Date(Date.now() + (facilitiesOwned ? 4 : 24) * 60 * 60 * 1000).toISOString(),
    escalationTo: "Facilities director",
  };
}

function outcomeLabel(outcome: VisitOutcome): string {
  return {
    resolved: "Resolved",
    temporary_repair: "Temporary repair completed",
    diagnosed_waiting_parts: "Diagnosed · waiting on parts",
    return_required: "Return visit needed",
    unable_to_reproduce: "Could not reproduce reported issue",
    unable_to_complete: "Unable to complete",
    other: "Other outcome",
  }[outcome];
}

function workOrderOutcomeLabel(outcome: WorkOrderVisitOutcome): string {
  return {
    completed: "Completed",
    temporary_repair: "Temporary repair — follow-up needed",
    diagnosis_only: "Diagnosis only",
    quote_required: "Quote required",
    parts_required: "Parts required",
    return_visit_required: "Return visit required",
    no_issue_found: "No issue found",
    store_access_unavailable: "Store access unavailable",
    work_not_authorized: "Work not authorized",
    not_addressed: "Not addressed",
  }[outcome];
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function receiveUploads(input: {
  organizationId: string;
  subjectType: "request" | "visit";
  subjectId: string;
  uploads: PublicUpload[];
  visibility: "internal" | "vendor_shared";
  channel?: VisitChannel;
  idempotencyKey?: string;
  actor: ActorContext;
}): Promise<{ received: number; attached: number; label?: string }> {
  if (!input.uploads.length) return { received: 0, attached: 0 };
  try {
    const results = await getPublicUploadStore().store(input);
    let attached = 0;
    for (const stored of results.filter((result) => result.stored)) {
      const existing = await runtime().repository.getStoredFileByStorageKey(input.organizationId, stored.key);
      if (existing) {
        attached += 1;
        continue;
      }
      try {
        await attachPublicEvidence({ repository: runtime().repository }, {
          organizationId: input.organizationId,
          entityType: input.subjectType,
          entityId: input.subjectId,
          storageKey: stored.key,
          sha256: stored.sha256,
          originalName: stored.originalName,
          contentType: stored.mediaType,
          byteLength: stored.size,
          purpose: stored.mediaType.startsWith("image/") ? "photo" : "service_document",
          visibility: input.visibility,
          channel: input.channel,
          actor: input.actor,
        });
        attached += 1;
      } catch {
        // A concurrent retry may have attached this same deterministic object
        // after our preflight read. Count the committed record, never a second
        // entity-file or evidence row.
        if (await runtime().repository.getStoredFileByStorageKey(input.organizationId, stored.key)) attached += 1;
      }
    }
    const label = attached === results.length
      ? `${attached} ${attached === 1 ? "file is" : "files are"} attached to the source record.`
      : attached === 0 && runtime().mode === "demo"
        ? `${results.length} ${results.length === 1 ? "file was" : "files were"} received for this Demo Mode action; durable local file storage is not active.`
        : `${attached} of ${results.length} files were attached. The remaining files need operator review.`;
    return { received: results.length, attached, label };
  } catch {
    return {
      received: input.uploads.length,
      attached: 0,
      label: `${input.uploads.length} ${input.uploads.length === 1 ? "file was" : "files were"} received, but attachment storage needs operator review.`,
    };
  }
}

async function replayCheckoutCapability(input: {
  repository: OpsRepository;
  visit: VisitSession;
  accessToken: string;
  submissionKey: string;
}) {
  const { repository, visit } = input;
  for (const namespace of [CHECKOUT_TOKEN_NAMESPACE, LEGACY_CHECKOUT_TOKEN_NAMESPACE]) {
    const token = await stableCheckoutToken(input.accessToken, input.submissionKey, namespace);
    const capability = await repository.getVisitByCheckoutToken({
      tokenHash: await hashOpaqueToken(token),
      purpose: "active_visit",
      now: now(),
    });
    if (
      capability
      && capability.visit.organizationId === visit.organizationId
      && capability.visit.id === visit.id
    ) {
      return { token, expiresAt: capability.expiresAt };
    }
  }
  throw new PublicWorkflowError("The prior checkout link is unavailable.", 409, "idempotency_result_unavailable");
}

function checkInReceipt(input: {
  visit: VisitSession;
  organizationName: string;
  workOrders: VisitWorkOrderView[];
  checkoutToken: string;
  checkoutExpiresAt: string;
  location: LocationEvidenceReceipt;
  replayed?: boolean;
}): TechnicianCheckInReceipt {
  return {
    receiptId: `receipt-${input.visit.id}`,
    receivedAt: input.visit.checkedInAt,
    mode: runtime().mode,
    heading: "You are checked in",
    message: `${input.organizationName} received this visit for ${input.visit.providerName}.`,
    replayed: input.replayed,
    visitId: input.visit.id,
    vendorName: input.visit.providerName,
    technicianName: input.visit.technicianName,
    workOrders: input.workOrders,
    crewCount: input.visit.crewCount ?? 1,
    additionalTechnicianNames: input.visit.additionalTechnicianNames ?? [],
    vehicleIdentifier: input.visit.vehicleIdentifier,
    arrivalNote: input.visit.arrivalNote,
    workOrderNumber: input.workOrders.length === 1 ? input.workOrders[0]!.number : undefined,
    checkedInAt: input.visit.checkedInAt,
    checkoutUrl: `/public/store/${encodeURIComponent(input.checkoutToken)}/visit`,
    checkoutExpiresAt: input.checkoutExpiresAt,
    location: input.location,
  };
}

function checkOutReceipt(input: {
  visit: VisitSession;
  store: Store;
  outcome?: VisitOutcome;
  workOrderOutcomes: TechnicianCheckOutReceipt["workOrderOutcomes"];
  location: LocationEvidenceReceipt;
  evidenceReceived: number;
  evidenceStorageLabel?: string;
  replayed?: boolean;
}): TechnicianCheckOutReceipt {
  const durationMinutes = Math.max(0, Math.round((input.visit.observedDurationSeconds ?? 0) / 60));
  const followUps = input.workOrderOutcomes.filter((outcome) => outcome.followUpLabel);
  return {
    receiptId: `receipt-${input.visit.id}-checkout`,
    receivedAt: input.visit.checkedOutAt!,
    mode: runtime().mode,
    heading: "Checkout received",
    message: `${input.visit.technicianName} is checked out of Store ${input.store.storeNumber}.`,
    replayed: input.replayed,
    visitId: input.visit.id,
    checkedOutAt: input.visit.checkedOutAt!,
    observedDurationMinutes: durationMinutes,
    observedDurationLabel: `${durationMinutes} minutes of approximate observed onsite time`,
    outcomeLabel: input.outcome
      ? outcomeLabel(input.outcome)
      : input.workOrderOutcomes.length === 1
        ? input.workOrderOutcomes[0]!.outcomeLabel
        : `${input.workOrderOutcomes.length} work-order outcomes recorded`,
    workOrderOutcomes: input.workOrderOutcomes,
    evidenceReceived: input.evidenceReceived,
    evidenceStorageLabel: input.evidenceStorageLabel,
    location: input.location,
    followUpLabel: followUps.length
      ? followUps.length === 1
        ? followUps[0]!.followUpLabel
        : `${followUps.length} work orders have an accountable follow-up.`
      : undefined,
  };
}

async function receiptWorkOrderOutcomes(
  repository: OpsRepository,
  organizationId: string,
  outcomes: readonly PerWorkOrderVisitOutcome[],
): Promise<TechnicianCheckOutReceipt["workOrderOutcomes"]> {
  return Promise.all(outcomes.map(async (outcome) => {
    const workOrder = await repository.getWorkOrder(organizationId, outcome.workOrderId);
    if (!workOrder) throw new PublicWorkflowError("A visit work order is no longer available.", 409, "work_order_unavailable");
    return {
      id: workOrder.id,
      number: workOrder.number,
      problem: workOrder.problem,
      outcome: outcome.outcome,
      outcomeLabel: workOrderOutcomeLabel(outcome.outcome),
      followUpLabel: outcome.followUp
        ? `${outcome.followUp.accountableParty} now owns: ${outcome.followUp.nextAction}.`
        : undefined,
    };
  }));
}

const gateway: PublicOperationsGateway = {
  async loadServiceAuthorization(token) {
    const resolved = await resolveServiceAuthorization(token);
    if (!resolved) return null;
    const source = resolved.view;
    return {
      organizationName: source.organizationName,
      organizationSupport: "Contact the facilities team through the original service message if you need help.",
      vendorName: source.vendor.name,
      operatorWorkOrderNumber: source.workOrderNumber,
      revision: source.revision,
      issuedAt: source.issuedAt,
      opened: source.assignmentStatus !== "issued",
      status: responseStatus(source),
      priority: displayPriority(source.priority),
      store: {
        number: source.store.storeNumber,
        name: source.store.name,
        address: source.store.formattedAddress,
        timeZone: source.store.timeZone,
      },
      service: {
        problem: source.problem,
        requestedWork: vendorFacingScope(source.authorizedScope),
        category: titleCase(source.categoryKey),
        asset: source.asset ? `${source.asset.name} · ${source.asset.assetTag}` : undefined,
        accessNotes: source.store.accessNotes,
      },
      authorization: {
        requestedBy: `${source.organizationName} Facilities`,
        billingInstruction: source.billingInstruction,
      },
      priorResponse: source.latestResponse ? {
        label: responseLabel(source.latestResponse.response),
        receivedAt: source.latestResponse.respondedAt,
        detail: source.latestResponse.message,
      } : undefined,
      technicianVisitUrl: `/public/store/${encodeURIComponent(token)}/visit`,
      mode: runtime().mode,
    };
  },

  async openServiceAuthorization(token) {
    const resolved = await resolveServiceAuthorization(token);
    if (!resolved) throw new PublicWorkflowError("This service link is unavailable.", 404, "link_unavailable");
    const source = resolved.view;
    try {
      const result = await markServiceAuthorizationOpened(
        { repository: runtime().repository },
        {
          organizationId: source.organizationId,
          workOrderId: source.workOrderId,
          assignmentId: source.assignmentId,
          issuanceId: source.issuanceId,
          actor: { actorType: "vendor_link", actorName: `${source.vendor.name} secure link`, organizationId: source.organizationId },
        },
      );
      return {
        receiptId: source.issuanceId,
        receivedAt: result.openedAt ?? now(),
        mode: runtime().mode,
        heading: "Service authorization opened",
        message: `You can now respond to ${source.organizationName} work order ${source.workOrderNumber}.`,
      };
    } catch (error) {
      return publicDomainError(error);
    }
  },

  async respondToServiceAuthorization(token, command) {
    const resolved = await resolveServiceAuthorization(token);
    if (!resolved) throw new PublicWorkflowError("This service link is unavailable.", 404, "link_unavailable");
    const source = resolved.view;
    if (source.latestResponse && ["accepted", "declined"].includes(source.latestResponse.response)) {
      throw new PublicWorkflowError("A final response has already been recorded for this authorization.", 409, "response_already_recorded");
    }
    if (source.assignmentStatus === "issued") {
      try {
        await markServiceAuthorizationOpened(
          { repository: runtime().repository },
          {
            organizationId: source.organizationId,
            workOrderId: source.workOrderId,
            assignmentId: source.assignmentId,
            issuanceId: source.issuanceId,
            actor: { actorType: "vendor_link", actorName: `${source.vendor.name} secure response`, organizationId: source.organizationId },
          },
        );
      } catch (error) {
        return publicDomainError(error);
      }
    }
    const responderName = cleanRequired(command.responderName, "Your name", 100);
    const detail = cleanOptional(command.detail, 1000);
    if ((command.response === "declined" || command.response === "question") && !detail) {
      throw new PublicWorkflowError(command.response === "declined" ? "Tell the operator why the work is being declined." : "Enter the question you want the operator to answer.", 422, "detail_required");
    }
    let proposedAt: string | undefined;
    if (command.response === "proposed_date") {
      const parsed = Date.parse(command.proposedArrival ?? "");
      if (!Number.isFinite(parsed)) throw new PublicWorkflowError("Choose a valid proposed arrival date and time.", 422, "proposed_date_required");
      proposedAt = new Date(parsed).toISOString();
    }
    try {
      const response = await recordVendorResponse({ repository: runtime().repository }, {
        organizationId: source.organizationId,
        workOrderId: source.workOrderId,
        assignmentId: source.assignmentId,
        issuanceId: source.issuanceId,
        response: command.response,
        responderName,
        proposedAt,
        message: detail,
        actor: { actorType: "vendor_link", actorName: responderName, organizationId: source.organizationId },
      });
      const messages: Record<VendorResponseKind, string> = {
        accepted: `${source.organizationName} has been notified that ${source.vendor.name} accepted this service authorization.`,
        declined: `${source.organizationName} has been notified that the service authorization was declined.`,
        proposed_date: `${source.organizationName} received the proposed arrival time.`,
        question: `Your question was sent to ${source.organizationName} Facilities.`,
      };
      return {
        receiptId: response.id,
        receivedAt: response.respondedAt,
        mode: runtime().mode,
        heading: "Response received",
        message: messages[command.response],
      };
    } catch (error) {
      return publicDomainError(error);
    }
  },

  async loadVendorEstimate(token): Promise<VendorEstimateView | null> {
    const resolved = await resolveVendorEstimate(token);
    if (!resolved) return null;
    const source = resolved.estimateRequest;
    const proposal = await runtime().repository.getLatestEstimateProposal(source.organizationId, source.id);
    const statusLabels: Record<typeof source.status, string> = {
      requested: "Link generated",
      opened: "Opened",
      submitted: "Bid submitted",
      declined: "Declined",
      expired: "Expired",
      withdrawn: "Withdrawn",
      selected: source.decisionKind === "replacement_quote" ? "Selected for capital review" : "Selected for authorization",
      not_selected: "Not selected",
    };
    const responseDeadlinePassed = Boolean(source.dueAt && Date.parse(source.dueAt) <= Date.parse(now()));
    const presentedStatus = responseDeadlinePassed && ["requested", "opened"].includes(source.status)
      ? "expired" as const
      : source.status;
    return {
      organizationName: resolved.organization.name,
      organizationSupport: "Contact the facilities team through the original bid-request message if you need clarification.",
      vendorName: resolved.vendor.name,
      operatorWorkOrderNumber: resolved.workOrder.number,
      status: presentedStatus,
      statusLabel: statusLabels[presentedStatus],
      requestKindLabel: source.decisionKind === "replacement_quote"
        ? "Replacement quote - capital pricing only"
        : source.kind === "diagnostic_and_estimate"
          ? "Bid request - onsite diagnosis requires separate authorization"
          : "Bid request - pricing only",
      decisionKind: source.decisionKind ?? "service_bid",
      requestedAt: source.requestedAt,
      dueAt: source.dueAt,
      store: {
        number: resolved.store.storeNumber,
        name: resolved.store.name,
        address: [resolved.store.address1, resolved.store.address2, `${resolved.store.city}, ${resolved.store.state} ${resolved.store.postalCode}`].filter(Boolean).join(", "),
        timeZone: resolved.store.timeZone,
      },
      problem: resolved.workOrder.problem,
      requestedScope: source.requestedScope,
      latestProposal: proposal ? {
        revision: proposal.revision,
        amountLabel: estimateMoneyLabel(proposal.amount.amountMinor, proposal.amount.currency),
        scope: proposal.scope,
        exclusions: proposal.exclusions,
        leadTimeDays: proposal.leadTimeDays,
        validUntil: proposal.validUntil,
        submittedAt: proposal.submittedAt,
      } : undefined,
      canRespond: !responseDeadlinePassed && ["opened", "submitted"].includes(source.status),
      mode: runtime().mode,
    };
  },

  async openVendorEstimate(token) {
    const resolved = await resolveVendorEstimate(token);
    if (!resolved) throw new PublicWorkflowError("This bid-request link is unavailable.", 404, "link_unavailable");
    try {
      const result = await markEstimateOpened(
        { repository: runtime().repository },
        {
          organizationId: resolved.estimateRequest.organizationId,
          estimateRequestId: resolved.estimateRequest.id,
          vendorId: resolved.estimateRequest.vendorId,
          tokenHash: resolved.tokenHash,
          actor: {
            actorType: "vendor_link",
            actorName: `${resolved.vendor.name} bid-request reviewer`,
            organizationId: resolved.estimateRequest.organizationId,
          },
        },
      );
      return {
        receiptId: result.request.id,
        receivedAt: result.request.openedAt ?? now(),
        mode: runtime().mode,
        heading: "Bid request opened",
        message: `You can now review and respond to ${resolved.organization.name} bid request for operator work order ${resolved.workOrder.number}. This is pricing only, not service authorization.`,
      };
    } catch (error) {
      return publicDomainError(error);
    }
  },

  async submitVendorEstimate(token, command) {
    const resolved = await resolveVendorEstimate(token);
    if (!resolved) throw new PublicWorkflowError("This bid-request link is unavailable.", 404, "link_unavailable");
    const responderName = cleanRequired(command.responderName, "Your name", 100);
    const scope = cleanRequired(command.scope, "Proposed scope", 4_000);
    const exclusions = cleanOptional(command.exclusions, 4_000);
    const normalizedAmount = command.amount.trim().replaceAll(",", "");
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedAmount)) {
      throw new PublicWorkflowError("Enter a valid bid amount with no more than two decimal places.", 422, "invalid_amount");
    }
    const amountMinor = Math.round(Number(normalizedAmount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new PublicWorkflowError("Bid amount must be greater than zero.", 422, "invalid_amount");
    }
    let validUntil: string | undefined;
    if (command.validUntil) {
      const parsed = Date.parse(`${command.validUntil}T23:59:59.999Z`);
      if (!Number.isFinite(parsed)) throw new PublicWorkflowError("Choose a valid bid expiration date.", 422, "invalid_date");
      validUntil = new Date(parsed).toISOString();
    }
    try {
      const result = await submitEstimate(
        { repository: runtime().repository },
        {
          organizationId: resolved.estimateRequest.organizationId,
          estimateRequestId: resolved.estimateRequest.id,
          vendorId: resolved.estimateRequest.vendorId,
          tokenHash: resolved.tokenHash,
          expectedRevision: command.expectedRevision,
          amountMinor,
          currency: command.currency ?? "USD",
          scope,
          exclusions,
          leadTimeDays: command.leadTimeDays,
          validUntil,
          actor: { actorType: "vendor_link", actorName: responderName, organizationId: resolved.estimateRequest.organizationId },
        },
      );
      return {
        receiptId: result.proposal.id,
        receivedAt: result.proposal.submittedAt,
        mode: runtime().mode,
        heading: "Bid received",
        message: `${resolved.organization.name} received bid revision ${result.proposal.revision} from ${resolved.vendor.name}. This is pricing evidence only; it does not assign work or authorize travel, check-in, service, or billing.`,
      };
    } catch (error) {
      return publicDomainError(error);
    }
  },

  async declineVendorEstimate(token, command) {
    const resolved = await resolveVendorEstimate(token);
    if (!resolved) throw new PublicWorkflowError("This bid-request link is unavailable.", 404, "link_unavailable");
    const responderName = cleanRequired(command.responderName, "Your name", 100);
    const reason = cleanRequired(command.reason, "Reason for declining", 2_000);
    try {
      const result = await declineEstimate(
        { repository: runtime().repository },
        {
          organizationId: resolved.estimateRequest.organizationId,
          estimateRequestId: resolved.estimateRequest.id,
          vendorId: resolved.estimateRequest.vendorId,
          tokenHash: resolved.tokenHash,
          expectedRevision: command.expectedRevision,
          reason,
          actor: { actorType: "vendor_link", actorName: responderName, organizationId: resolved.estimateRequest.organizationId },
        },
      );
      return {
        receiptId: result.request.id,
        receivedAt: result.request.respondedAt ?? now(),
        mode: runtime().mode,
        heading: "Bid request declined",
        message: `${resolved.organization.name} received the decline reason. No assignment, service authorization, visit, cost, invoice, or billable work was created.`,
      };
    } catch (error) {
      return publicDomainError(error);
    }
  },

  async loadStorePortal(token) {
    const access = await resolvePublicAccess(token);
    return access ? portalFromAccess(access) : null;
  },

  async lookupVendorVisitContext(token, vendorId) {
    const access = await resolvePublicAccess(token);
    if (!access) throw new PublicWorkflowError("This store link is unavailable.", 404, "link_unavailable");
    return getContextFromAccess(access, cleanOptional(vendorId, 120));
  },

  async addHeldWorkToVisit(token, command) {
    const access = await resolvePublicAccess(token);
    if (!access || (access.kind !== "visit" && access.kind !== "trusted_store")) {
      throw new PublicWorkflowError("Use the active visit link or trusted store computer to add work after check-in.", 403, "active_visit_access_required");
    }
    const repository = runtime().repository;
    const submissionKey = cleanSubmissionKey(command.submissionKey);
    const visitId = cleanRequired(command.visitId, "Visit", 120);
    const heldWorkOrderIds = command.heldWorkOrderIds.map((workOrderId) => cleanRequired(workOrderId, "Additional approved work", 120));
    if (!heldWorkOrderIds.length || heldWorkOrderIds.length > 100 || new Set(heldWorkOrderIds).size !== heldWorkOrderIds.length) {
      throw new PublicWorkflowError("Choose each additional approved item once, up to 100 items.", 422, "invalid_held_work_selection");
    }
    if (access.kind === "visit" && access.activeVisit.id !== visitId) {
      throw new PublicWorkflowError("That visit does not match this secure link.", 403, "visit_not_available");
    }
    const organizationId = accessOrganizationId(access);
    const store = accessStore(access);
    const visit = await repository.getVisit(organizationId, visitId);
    if (!visit || visit.storeId !== store.id || visit.status !== "active" || visit.providerKind !== "outside_vendor" || !visit.vendorId) {
      throw new PublicWorkflowError("That vendor visit is no longer active at this store.", 409, "visit_not_active");
    }
    const requestHash = await hashRequest({ version: 1, tokenHash: access.tokenHash, organizationId, storeId: store.id, visitId, heldWorkOrderIds });
    const replayed = await idempotentVisitResult({ repository, organizationId, submissionKey, command: PUBLIC_ADD_HELD_WORK_COMMAND, requestHash });
    if (replayed) return getContextFromAccess(access, visit.vendorId);
    const vendorContext = await getContextFromAccess(access, visit.vendorId);
    const availableIds = new Set(vendorContext.heldWork.map((workOrder) => workOrder.id));
    if (heldWorkOrderIds.some((workOrderId) => !availableIds.has(workOrderId))) {
      throw new PublicWorkflowError("One or more selected items are no longer available to this vendor.", 409, "held_work_not_available");
    }
    try {
      await addHeldWorkToActiveVisit({ repository }, {
        organizationId,
        visitId,
        heldWorkOrderIds,
        actor: { actorType: "technician", actorName: visit.technicianName, organizationId },
        idempotency: { key: submissionKey, command: PUBLIC_ADD_HELD_WORK_COMMAND, requestHash, expiresAt: idempotencyExpiresAt() },
      });
      return getContextFromAccess(access, visit.vendorId);
    } catch (error) {
      const concurrentReplay = await idempotentVisitResult({ repository, organizationId, submissionKey, command: PUBLIC_ADD_HELD_WORK_COMMAND, requestHash });
      if (concurrentReplay) return getContextFromAccess(access, visit.vendorId);
      return publicDomainError(error);
    }
  },

  async checkIn(token, command) {
    const access = await resolvePublicAccess(token);
    if (!access) throw new PublicWorkflowError("This store link is unavailable.", 404, "link_unavailable");
    if (access.kind === "visit") throw new PublicWorkflowError("A checkout link cannot start another visit.", 403, "action_not_allowed");
    const repository = runtime().repository;
    const submissionKey = cleanSubmissionKey(command.submissionKey);
    const vendorId = cleanOptional(command.vendorId, 120);
    const compatibilityWorkOrderId = cleanOptional(command.workOrderId, 120);
    const listedWorkOrderIds = command.workOrderIds?.map((workOrderId) => cleanRequired(workOrderId, "Work order", 120));
    if (compatibilityWorkOrderId && listedWorkOrderIds && (
      listedWorkOrderIds.length !== 1 || listedWorkOrderIds[0] !== compatibilityWorkOrderId
    )) {
      throw new PublicWorkflowError("The work-order selection is inconsistent.", 422, "invalid_work_order_selection");
    }
    const workOrderIds = listedWorkOrderIds ?? (compatibilityWorkOrderId ? [compatibilityWorkOrderId] : []);
    if (workOrderIds.length > 100 || new Set(workOrderIds).size !== workOrderIds.length) {
      throw new PublicWorkflowError("Choose each work order once, up to 100 work orders.", 422, "invalid_work_order_selection");
    }
    const heldWorkOrderIds = (command.heldWorkOrderIds ?? []).map((workOrderId) => cleanRequired(workOrderId, "Held work", 120));
    if (heldWorkOrderIds.length > 100 || new Set(heldWorkOrderIds).size !== heldWorkOrderIds.length || heldWorkOrderIds.some((id) => workOrderIds.includes(id))) {
      throw new PublicWorkflowError("Choose each held item once; it cannot also be selected as issued work.", 422, "invalid_held_work_selection");
    }
    const technicianName = cleanRequired(command.technicianName, "Technician name", 100);
    const technicianPhoneOrPin = cleanOptional(command.technicianPhoneOrPin, 100);
    const crewCount = command.crewCount ?? 1;
    if (!Number.isInteger(crewCount) || crewCount < 1 || crewCount > 100) {
      throw new PublicWorkflowError("Crew count must be a whole number between 1 and 100.", 422, "invalid_crew_count");
    }
    const additionalTechnicianNames = (command.additionalTechnicianNames ?? []).map((name) => cleanRequired(name, "Additional technician name", 100));
    if (additionalTechnicianNames.length > crewCount - 1) {
      throw new PublicWorkflowError("Additional technician names cannot exceed the crew count.", 422, "invalid_crew_count");
    }
    const normalizedNames = [technicianName, ...additionalTechnicianNames].map((name) => name.toLocaleLowerCase("en-US"));
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new PublicWorkflowError("Technician names cannot be duplicated.", 422, "duplicate_technician");
    }
    const vehicleIdentifier = cleanOptional(command.vehicleIdentifier, 120);
    const arrivalNote = cleanOptional(command.arrivalNote, 1_000);
    const serviceRunId = cleanOptional(command.serviceRunId, 120);
    const plannedWorkOrderRemovalReason = cleanOptional(command.plannedWorkOrderRemovalReason, 1_000);
    const unmatchedReason = workOrderIds.length ? undefined : cleanRequired(command.noWorkOrderReason ?? "", "Reason for visit", 500);
    if (!workOrderIds.length && !vendorId) throw new PublicWorkflowError("Choose an approved vendor for a visit without a work order.", 422, "missing_vendor");
    if (!workOrderIds.length && access.kind === "service") {
      throw new PublicWorkflowError("This service-authorization link can start only its assigned work order.", 403, "service_token_work_order_bound");
    }
    const organizationId = accessOrganizationId(access);
    const storeView = accessStore(access);
    const store = await repository.getStore(organizationId, storeView.id);
    if (!store) throw new PublicWorkflowError("This store is unavailable.", 404, "store_unavailable");
    const location = access.kind === "trusted_store" ? trustedStoreLocation() : evaluateLocation(store, command.location);
    const requestHash = await hashRequest({
      version: 2,
      tokenHash: access.tokenHash,
      organizationId,
      storeId: store.id,
      channel: access.channel,
      vendorId: vendorId ?? null,
      workOrderIds,
      heldWorkOrderIds,
      unmatchedReason: unmatchedReason ?? null,
      technicianName,
      technicianPhoneOrPin: technicianPhoneOrPin ?? null,
      crewCount,
      additionalTechnicianNames,
      vehicleIdentifier: vehicleIdentifier ?? null,
      arrivalNote: arrivalNote ?? null,
      serviceRunId: serviceRunId ?? null,
      plannedWorkOrderRemovalReason: plannedWorkOrderRemovalReason ?? null,
      location: command.location,
    });

    const replayPrior = async (): Promise<TechnicianCheckInReceipt | null> => {
      const prior = await idempotentVisitResult({
        repository,
        organizationId,
        submissionKey,
        command: PUBLIC_CHECK_IN_COMMAND,
        requestHash,
      });
      if (!prior) return null;
      if (
        prior.storeId !== store.id
        || prior.providerKind !== "outside_vendor"
        || (vendorId && prior.vendorId !== vendorId)
        || prior.technicianName !== technicianName
        || prior.technicianPhoneOrPin !== technicianPhoneOrPin
        || (prior.crewCount ?? 1) !== crewCount
        || !sameStringList(prior.additionalTechnicianNames ?? [], additionalTechnicianNames)
        || prior.vehicleIdentifier !== vehicleIdentifier
        || prior.arrivalNote !== arrivalNote
      ) {
        throw new PublicWorkflowError("The prior visit receipt does not match this store action.", 409, "idempotency_result_mismatch");
      }
      const priorWorkOrders = await publicWorkOrdersForVisit(repository, organizationId, prior);
      if (!sameStringList(priorWorkOrders.map((workOrder) => workOrder.id), [...workOrderIds, ...heldWorkOrderIds])) {
        throw new PublicWorkflowError("The prior visit receipt does not match this work selection.", 409, "idempotency_result_mismatch");
      }
      const checkout = await replayCheckoutCapability({ repository, visit: prior, accessToken: token, submissionKey });
      return checkInReceipt({
        visit: prior,
        organizationName: accessOrganizationName(access),
        workOrders: priorWorkOrders,
        checkoutToken: checkout.token,
        checkoutExpiresAt: checkout.expiresAt,
        location: access.kind === "trusted_store" ? trustedStoreLocation(prior.checkedInAt).receipt : location.receipt,
        replayed: true,
      });
    };

    const replayed = await replayPrior();
    if (replayed) return replayed;

    const context = await getContextFromAccess(access);
    if (access.kind === "service" && !sameStringList(workOrderIds, [access.serviceAuthorization.workOrderId])) {
      throw new PublicWorkflowError("This service-authorization link can start only its assigned work order.", 403, "service_token_work_order_bound");
    }
    const eligibleById = new Map(context.eligibleWorkOrders.map((workOrder) => [workOrder.id, workOrder]));
    const selectedWork = workOrderIds.map((workOrderId) => eligibleById.get(workOrderId));
    if (selectedWork.some((workOrder) => !workOrder)) {
      throw new PublicWorkflowError("One or more selected work orders are not eligible at this store.", 403, "work_order_not_eligible");
    }
    const selected = selectedWork as EligibleWorkOrderView[];
    const inferredVendorId = selected[0]?.assignedVendor.id;
    if (selected.some((workOrder) => workOrder.assignedVendor.id !== inferredVendorId)) {
      throw new PublicWorkflowError("One visit can include only work assigned to the same vendor.", 403, "mixed_visit_vendor");
    }
    if (selected.length && vendorId && vendorId !== inferredVendorId) {
      throw new PublicWorkflowError("The selected work orders determine the vendor and cannot be overridden.", 403, "vendor_override_not_allowed");
    }
    const effectiveVendorId = selected.length ? inferredVendorId : vendorId;
    const vendorContext = await getContextFromAccess(access, effectiveVendorId);
    const heldById = new Map(vendorContext.heldWork.map((workOrder) => [workOrder.id, workOrder]));
    const selectedHeldWork = heldWorkOrderIds.map((workOrderId) => heldById.get(workOrderId));
    if (selectedHeldWork.some((workOrder) => !workOrder)) {
      throw new PublicWorkflowError("One or more held items are no longer available to this vendor.", 409, "held_work_not_available");
    }
    if (access.kind === "service" && heldWorkOrderIds.length) {
      throw new PublicWorkflowError("This service-authorization link is limited to its assigned work order.", 403, "service_token_work_order_bound");
    }
    if (serviceRunId) {
      const plannedRun = context.plannedServiceRuns.find((run) => run.id === serviceRunId);
      if (!plannedRun) throw new PublicWorkflowError("This committed Service Run is not available at this Store.", 403, "service_run_not_available");
      const selectedSet = new Set(selected.map((workOrder) => workOrder.id));
      const removed = plannedRun.plannedWorkOrderIds.filter((workOrderId) => !selectedSet.has(workOrderId));
      if (removed.length && !plannedWorkOrderRemovalReason) throw new PublicWorkflowError("Explain why planned Service Run work is not being addressed during this visit.", 422, "planned_work_removal_reason_required");
    } else if (plannedWorkOrderRemovalReason) {
      throw new PublicWorkflowError("A planned-work removal reason requires a committed Service Run.", 422, "service_run_required");
    }
    try {
      const checkoutToken = await stableCheckoutToken(token, submissionKey);
      const checkoutExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const result = await checkInVisitWithCheckoutToken({ repository }, {
        organizationId,
        storeId: store.id,
        vendorId: selected.length ? undefined : vendorId,
        workOrderIds: selected.map((workOrder) => workOrder.id),
        heldWorkOrderIds,
        serviceRunId,
        plannedWorkOrderRemovalReason,
        unmatchedReason,
        technicianName,
        technicianPhoneOrPin,
        crewCount,
        additionalTechnicianNames,
        vehicleIdentifier,
        arrivalNote,
        purpose: selected.length
          ? selected.map((workOrder) => `${workOrder.number}: ${workOrder.problem}`).join("; ")
          : unmatchedReason!,
        channel: access.channel,
        location: location.observation,
        actor: { actorType: "technician", actorName: technicianName, organizationId },
        checkoutToken: {
          tokenHash: await hashOpaqueToken(checkoutToken),
          expiresAt: checkoutExpiresAt,
        },
        idempotency: {
          key: submissionKey,
          command: PUBLIC_CHECK_IN_COMMAND,
          requestHash,
          expiresAt: idempotencyExpiresAt(),
        },
      });
      return checkInReceipt({
        visit: result.visit,
        organizationName: accessOrganizationName(access),
        workOrders: [
          ...selected.map((workOrder) => ({ id: workOrder.id, number: workOrder.number, problem: workOrder.problem, selectionSource: serviceRunId ? "service_run" as const : "assigned_work" as const })),
          ...(selectedHeldWork as NonNullable<(typeof selectedHeldWork)[number]>[]).map((workOrder) => ({ id: workOrder.id, number: workOrder.number, problem: workOrder.problem, selectionSource: "held_work" as const, heldWorkPosture: workOrder.posture })),
        ],
        checkoutToken,
        checkoutExpiresAt,
        location: location.receipt,
      });
    } catch (error) {
      const concurrentReplay = await replayPrior();
      if (concurrentReplay) return concurrentReplay;
      return publicDomainError(error);
    }
  },

  async checkOut(token, command) {
    const repository = runtime().repository;
    const submissionKey = cleanSubmissionKey(command.submissionKey);
    const suppliedVendorId = cleanOptional(command.vendorId, 120);
    const visitId = cleanRequired(command.visitId, "Visit", 120);
    const tokenHash = await hashOpaqueToken(token);
    const access = await resolvePublicAccess(token);
    if (access && access.kind !== "visit" && access.kind !== "trusted_store") {
      throw new PublicWorkflowError("Use the secure checkout link from the check-in receipt to finish this visit.", 403, "visit_token_required");
    }

    // An active-visit link intentionally disappears from the regular portal
    // after checkout. Resolve its visit narrowly here so a lost HTTP response
    // can still replay the committed checkout receipt.
    const tokenCapability = access
      ? null
      : await repository.getVisitByCheckoutToken({ tokenHash, purpose: "active_visit", now: now() });
    const tokenVisit = tokenCapability?.visit ?? null;
    if (!access && !tokenVisit) throw new PublicWorkflowError("This store link is unavailable.", 404, "link_unavailable");

    const organizationId = access ? accessOrganizationId(access) : tokenVisit!.organizationId;
    const storeId = access ? accessStore(access).id : tokenVisit!.storeId;
    if (access?.kind === "visit") {
      if (visitId !== access.activeVisit.id || (suppliedVendorId && suppliedVendorId !== access.activeVisit.vendorId)) {
        throw new PublicWorkflowError("That visit does not match this secure checkout link.", 403, "visit_not_available");
      }
    } else if (tokenVisit && (
      tokenVisit.id !== visitId
      || tokenVisit.providerKind !== "outside_vendor"
      || (suppliedVendorId && tokenVisit.vendorId !== suppliedVendorId)
    )) {
      throw new PublicWorkflowError("That visit does not match this secure checkout link.", 403, "visit_not_available");
    }

    const visit = await repository.getVisit(organizationId, visitId);
    if (!visit || visit.storeId !== storeId || visit.providerKind !== "outside_vendor" || !visit.vendorId || (suppliedVendorId && visit.vendorId !== suppliedVendorId)) {
      throw new PublicWorkflowError("That visit is not available from this store link.", 403, "visit_not_available");
    }
    const vendorId = visit.vendorId;
    const store = await repository.getStore(organizationId, storeId);
    if (!store) throw new PublicWorkflowError("This store is unavailable.", 404, "store_unavailable");
    const location = access?.kind === "trusted_store" ? trustedStoreLocation() : evaluateLocation(store, command.location);
    const visitLinks = await repository.listSiteVisitWorkOrders(organizationId, visit.id);
    const outcomeNotes = cleanOptional(command.outcomeNotes, 2_000);
    const allowedWorkOutcomes = new Set<SiteVisitWorkOrderOutcome>([
      "completed", "temporary_repair", "diagnosis_only", "quote_required", "parts_required", "return_visit_required",
      "no_issue_found", "store_access_unavailable", "work_not_authorized", "not_addressed",
    ]);
    if (command.perWorkOrderOutcomes?.length && command.outcome) {
      throw new PublicWorkflowError("Do not mix per-work-order outcomes with the unmatched visit outcome.", 422, "mixed_outcome_contract");
    }
    const explicitOutcomes = command.perWorkOrderOutcomes?.map((entry): PerWorkOrderVisitOutcome => {
      if (!allowedWorkOutcomes.has(entry.outcome)) throw new PublicWorkflowError("Choose a valid outcome for every work order.", 422, "invalid_outcome");
      const visitLink = visitLinks.find((link) => link.workOrderId === entry.workOrderId);
      const heldItem = Boolean(visitLink?.workOrderHoldId);
      const requiresFollowUp = heldItem
        ? !["completed", "not_addressed"].includes(entry.outcome)
        : siteVisitOutcomeRequiresFollowUp(entry.outcome);
      const followUp = heldItem ? undefined : entry.followUp ? {
        accountableParty: cleanRequired(entry.followUp.accountableParty, "Follow-up owner", 160),
        nextAction: cleanRequired(entry.followUp.nextAction, "Follow-up next action", 1_000),
        dueAt: cleanRequired(entry.followUp.dueAt, "Follow-up due time", 80),
        escalationTo: cleanRequired(entry.followUp.escalationTo, "Follow-up escalation", 160),
      } : requiresFollowUp ? followUpForWorkOrderOutcome(entry.outcome, visit.providerName) : undefined;
      if (followUp && !Number.isFinite(Date.parse(followUp.dueAt))) {
        throw new PublicWorkflowError("Each follow-up needs a valid due time.", 422, "invalid_follow_up_due_at");
      }
      if (!heldItem && requiresFollowUp && !followUp) {
        throw new PublicWorkflowError("Every unresolved work-order outcome needs its own accountable follow-up.", 422, "follow_up_required");
      }
      if (!requiresFollowUp && followUp) {
        throw new PublicWorkflowError("A completed outcome cannot create an unresolved-work follow-up.", 422, "follow_up_not_allowed");
      }
      return {
        workOrderId: cleanRequired(entry.workOrderId, "Work order", 120),
        outcome: entry.outcome,
        outcomeNotes: cleanOptional(entry.outcomeNotes, 2_000),
        vendorFollowUpTiming: entry.vendorFollowUpTiming,
        followUp,
      };
    });
    let perWorkOrderOutcomes: PerWorkOrderVisitOutcome[] = [];
    if (visitLinks.length) {
      if (explicitOutcomes) {
        perWorkOrderOutcomes = explicitOutcomes;
      } else if (visitLinks.length === 1 && command.outcome) {
        // Compatibility for already-issued one-WO links. The public UI uses
        // the exact per-WO outcome contract below.
        const mappedOutcome = command.outcome === "unable_to_reproduce"
          ? "not_addressed"
          : siteVisitOutcomeFromLegacy(command.outcome);
        perWorkOrderOutcomes = [{
          workOrderId: visitLinks[0]!.workOrderId,
          outcome: mappedOutcome,
          outcomeNotes,
          followUp: siteVisitOutcomeRequiresFollowUp(mappedOutcome)
            ? followUpForOutcome(command.outcome, visit.providerName)
            : undefined,
        }];
      } else {
        throw new PublicWorkflowError("Provide exactly one outcome for every selected work order.", 422, "incomplete_work_order_outcomes");
      }
      const linkedIds = visitLinks.map((link) => link.workOrderId);
      const outcomeIds = perWorkOrderOutcomes.map((entry) => entry.workOrderId);
      if (
        outcomeIds.length !== linkedIds.length
        || new Set(outcomeIds).size !== outcomeIds.length
        || linkedIds.some((workOrderId) => !outcomeIds.includes(workOrderId))
      ) {
        throw new PublicWorkflowError("Provide exactly one outcome for every selected work order.", 422, "incomplete_work_order_outcomes");
      }
    } else {
      if (explicitOutcomes?.length) throw new PublicWorkflowError("A visit without a work order cannot record work-order outcomes.", 422, "unexpected_work_order_outcomes");
      if (!command.outcome) throw new PublicWorkflowError("Visit outcome is required.", 422, "missing_outcome");
    }
    const evidence = await Promise.all(command.evidence.map(async (upload) => ({
      name: upload.name,
      mediaType: upload.mediaType,
      size: upload.size,
      sha256: await hashUpload(upload),
    })));
    const requestHash = await hashRequest({
      version: 2,
      tokenHash,
      organizationId,
      storeId,
      vendorId,
      visitId,
      perWorkOrderOutcomes: command.perWorkOrderOutcomes ? perWorkOrderOutcomes : null,
      outcome: command.outcome ?? null,
      outcomeNotes: outcomeNotes ?? null,
      location: command.location,
      evidence,
    });

    const replayPrior = async (): Promise<TechnicianCheckOutReceipt | null> => {
      const prior = await idempotentVisitResult({
        repository,
        organizationId,
        submissionKey,
        command: PUBLIC_CHECK_OUT_COMMAND,
        requestHash,
      });
      if (!prior) return null;
      if (prior.id !== visit.id) {
        throw new PublicWorkflowError("The prior checkout receipt does not match this visit.", 409, "idempotency_result_mismatch");
      }
      if (prior.status !== "checked_out" || !prior.checkedOutAt) {
        throw new PublicWorkflowError("The prior checkout result is unavailable.", 409, "idempotency_result_unavailable");
      }
      const priorLinks = await repository.listSiteVisitWorkOrders(organizationId, prior.id);
      if (perWorkOrderOutcomes.length) {
        const priorOutcomeByWork = new Map(priorLinks.map((link) => [link.workOrderId, link.outcome]));
        if (perWorkOrderOutcomes.some((entry) => priorOutcomeByWork.get(entry.workOrderId) !== entry.outcome)) {
          throw new PublicWorkflowError("The prior checkout result does not match these work-order outcomes.", 409, "idempotency_result_mismatch");
        }
      } else if (prior.outcome !== command.outcome) {
        throw new PublicWorkflowError("The prior checkout result does not match this visit outcome.", 409, "idempotency_result_mismatch");
      }
      const replayActor: ActorContext = access?.kind === "trusted_store"
        ? { actorType: "store_device", actorName: `Store ${store.storeNumber} service desk`, organizationId }
        : { actorType: "technician", actorName: prior.technicianName, organizationId };
      const replayUploads = await receiveUploads({
        organizationId,
        subjectType: "visit",
        subjectId: prior.id,
        uploads: command.evidence,
        visibility: "vendor_shared",
        channel: access?.kind === "trusted_store" ? "store_device" : "secure_link",
        idempotencyKey: submissionKey,
        actor: replayActor,
      });
      return checkOutReceipt({
        visit: prior,
        store,
        outcome: command.outcome,
        workOrderOutcomes: await receiptWorkOrderOutcomes(repository, organizationId, perWorkOrderOutcomes),
        location: access?.kind === "trusted_store" ? trustedStoreLocation(prior.checkedOutAt).receipt : location.receipt,
        evidenceReceived: replayUploads.received,
        evidenceStorageLabel: replayUploads.label
          ? `Checkout was already recorded. ${replayUploads.label}`
          : undefined,
        replayed: true,
      });
    };

    const replayed = await replayPrior();
    if (replayed) return replayed;

    if (!access || visit.status !== "active" || visit.checkedOutAt) {
      throw new PublicWorkflowError("That active visit is not available from this store link.", 403, "visit_not_available");
    }
    if (access.kind === "trusted_store") {
      const trustedVisit = access.trustedStore.activeVisits.find((candidate) => (
        candidate.id === visitId
        && candidate.providerKind === "outside_vendor"
        && candidate.vendorId === visit.vendorId
      ));
      if (!trustedVisit) {
        throw new PublicWorkflowError("That active visit is not available on this store device.", 403, "visit_not_available");
      }
    }

    try {
      const checkoutActor: ActorContext = access.kind === "trusted_store"
        ? { actorType: "store_device", actorName: `Store ${store.storeNumber} service desk`, organizationId }
        : { actorType: "technician", actorName: visit.technicianName, organizationId };
      const completed = await checkOutVisit({ repository }, {
        organizationId,
        visitId: visit.id,
        channel: access.channel,
        ...(visitLinks.length
          ? { perWorkOrderOutcomes }
          : { outcome: command.outcome as OpsVisitOutcome, outcomeNotes }),
        location: location.observation,
        idempotency: {
          key: submissionKey,
          command: PUBLIC_CHECK_OUT_COMMAND,
          requestHash,
          expiresAt: idempotencyExpiresAt(),
        },
        actor: checkoutActor,
      });
      const uploadActor: ActorContext = checkoutActor;
      const uploads = await receiveUploads({
        organizationId,
        subjectType: "visit",
        subjectId: visit.id,
        uploads: command.evidence,
        visibility: "vendor_shared",
        channel: access.channel,
        idempotencyKey: submissionKey,
        actor: uploadActor,
      });
      return checkOutReceipt({
        visit: completed,
        store,
        outcome: command.outcome,
        workOrderOutcomes: await receiptWorkOrderOutcomes(repository, organizationId, perWorkOrderOutcomes),
        location: location.receipt,
        evidenceReceived: uploads.received,
        evidenceStorageLabel: uploads.label,
      });
    } catch (error) {
      const concurrentReplay = await replayPrior();
      if (concurrentReplay) return concurrentReplay;
      return publicDomainError(error);
    }
  },

  async reportStoreIssue(token, command) {
    const access = await resolvePublicAccess(token);
    if (!access || (access.kind !== "trusted_store" && (access.kind !== "store" || !access.storeGateway.actions.includes("report_issue")))) {
      throw new PublicWorkflowError("This link cannot submit a store issue.", 403, "action_not_allowed");
    }
    const repository = runtime().repository;
    const submissionKey = cleanSubmissionKey(command.submissionKey);
    const organizationId = accessOrganizationId(access);
    const storeView = accessStore(access);
    const reporterName = cleanRequired(command.reporterName, "Your name", 100);
    const problem = cleanRequired(command.problem, "Problem description", 2000);
    const employeeId = cleanOptional(command.employeeId, 80);
    const area = cleanOptional(command.area, 120);
    const storedProblem = area ? `Area or equipment: ${area}\n\n${problem}` : problem;
    const priority = command.urgency === "urgent_safety"
      || command.impact.safetyConcern === "immediate"
      || command.impact.storeOperatingState === "unable_to_operate"
      ? "emergency"
      : command.urgency === "priority"
        || command.impact.storeOperatingState === "partially_operational"
        || command.impact.productInventoryRisk === "at_risk"
        || command.impact.productInventoryRisk === "loss_reported"
        || command.impact.customersAffected === "yes"
        ? "urgent"
        : "routine";
    const impact = {
      ...command.impact,
      complianceImpact: "unknown" as const,
      redundantEquipment: "unknown" as const,
      confidence: "low" as const,
      source: "store_report" as const,
      notes: "Store-reported operating facts; facilities review is required before work-order creation. Any later monetary or downtime estimates are planning context, not verified losses.",
    };
    const evidence = await Promise.all(command.evidence.map(async (upload) => ({
      name: upload.name,
      mediaType: upload.mediaType,
      size: upload.size,
      sha256: await hashUpload(upload),
    })));
    const requestHash = await hashRequest({
      version: 1,
      tokenHash: access.tokenHash,
      organizationId,
      storeId: storeView.id,
      reporterName,
      employeeId: employeeId ?? null,
      problem,
      area: area ?? null,
      storedProblem,
      urgency: command.urgency,
      priority,
      impact,
      evidence,
    });
    const receiptFor = async (request: ServiceRequest, replayed = false): Promise<StoreIssueReceipt> => {
      if (request.storeId !== storeView.id) {
        throw new PublicWorkflowError("The prior issue receipt does not match this store.", 409, "idempotency_result_mismatch");
      }
      const uploadActor: ActorContext = { actorType: "store_device", actorName: reporterName, organizationId };
      const uploads = await receiveUploads({
        organizationId,
        subjectType: "request",
        subjectId: request.id,
        uploads: command.evidence,
        visibility: "internal",
        idempotencyKey: submissionKey,
        actor: uploadActor,
      });
      return {
        receiptId: `receipt-${request.id}`,
        receivedAt: request.submittedAt,
        mode: runtime().mode,
        heading: "Issue reported",
        message: `Store ${storeView.storeNumber} management received the problem report.`,
        requestNumber: request.reference,
        storeNumber: storeView.storeNumber,
        evidenceReceived: uploads.received,
        evidenceStorageLabel: replayed && uploads.label
          ? `The issue was already recorded. ${uploads.label}`
          : uploads.label,
        nextStep: command.urgency === "urgent_safety"
          ? "The report is marked as a safety or shutdown concern. Follow store emergency procedures now; this form does not replace emergency services."
          : "The store manager will review the report and decide the next action. The original report remains in the record.",
        replayed: replayed || undefined,
      };
    };
    const replayPrior = async () => idempotentServiceRequestResult({
      repository,
      organizationId,
      submissionKey,
      requestHash,
    });
    const replayed = await replayPrior();
    if (replayed) return receiptFor(replayed, true);
    try {
      const request = await createServiceRequest({ repository }, {
        organizationId,
        storeId: storeView.id,
        reporterName,
        reporterEmployeeId: employeeId,
        problem: storedProblem,
        priority,
        impact,
        idempotency: {
          key: submissionKey,
          command: PUBLIC_STORE_ISSUE_COMMAND,
          requestHash,
          expiresAt: idempotencyExpiresAt(),
        },
        actor: { actorType: "store_device", actorName: reporterName, organizationId },
      });
      return receiptFor(request);
    } catch (error) {
      const concurrentReplay = await replayPrior();
      if (concurrentReplay) return receiptFor(concurrentReplay, true);
      return publicDomainError(error);
    }
  },
};

export function getPublicOperationsGateway(): PublicOperationsGateway {
  // All public channels resolve a purpose-bound token, then invoke the same
  // lib/ops repository and domain commands used by authenticated operator UI.
  return gateway;
}
