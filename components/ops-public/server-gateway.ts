import {
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
import { getServerOpsRepositoryProxy } from "@/lib/server/ops-repository-provider";
import type { ActorContext, LocationObservation, Store, VendorResponseKind, VisitChannel, VisitOutcome as OpsVisitOutcome, VisitSession } from "@/lib/ops/types";
import type {
  ActiveVisitView as OpsActiveVisitView,
  PublicStoreGatewayView,
  ServiceAuthorizationView as OpsServiceAuthorizationView,
  StoreVisitContextView as OpsStoreVisitContextView,
  TrustedStoreDeviceView,
} from "@/lib/ops/view-models";
import type {
  ActiveVisitView,
  EligibleWorkOrderView,
  LocationEvidenceInput,
  LocationEvidenceReceipt,
  PublicOperationsGateway,
  PublicUpload,
  ServiceAuthorizationView,
  StorePortalView,
  TechnicianCheckInReceipt,
  TechnicianCheckOutReceipt,
  VendorEstimateView,
  VendorVisitContextView,
  VisitOutcome,
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

async function stableCheckoutToken(accessToken: string, submissionKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`traceops-checkout-v1\u0000${accessToken}\u0000${submissionKey}`),
  );
  return base64Url(new Uint8Array(digest));
}

const PUBLIC_CHECK_IN_COMMAND = "public_technician_check_in";
const PUBLIC_CHECK_OUT_COMMAND = "public_technician_check_out";
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
        ? "This trusted store computer records the exact server time. No PIN or location permission is needed."
        : "Location is requested only when a technician checks in or out. TraceOps does not track anyone continuously.",
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

function moneyLabel(amountMinor: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100)} ${currency} without additional approval`;
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

async function getContextFromAccess(access: PublicAccess, vendorId: string): Promise<VendorVisitContextView> {
  const repository = runtime().repository;
  const vendors = accessVendors(access);
  const vendor = vendors.find((candidate) => candidate.id === vendorId);
  if (!vendor) throw new PublicWorkflowError("Choose an approved vendor from this store's list.", 403, "vendor_not_available");
  const store = accessStore(access);
  const organizationId = accessOrganizationId(access);
  let sourceContext: OpsStoreVisitContextView | null = null;
  if (access.kind === "store") {
    sourceContext = await repository.getStoreVisitContextByToken({
      tokenHash: access.tokenHash,
      purpose: "store_gateway",
      now: now(),
      vendorId,
    });
  }
  const scope = { organizationId, storeIds: [store.id] };
  const sourceWork: Array<{ id: string; number: string; problem: string; categoryKey?: string }> = sourceContext?.eligibleWorkOrders
    ?? (access.kind === "service"
      ? [{
          id: access.serviceAuthorization.workOrderId,
          number: access.serviceAuthorization.workOrderNumber,
          problem: access.serviceAuthorization.problem,
          categoryKey: access.serviceAuthorization.categoryKey,
        }]
      : access.kind === "trusted_store"
        ? (await repository.listWorkOrders(scope, {
            vendorId,
            statuses: ["issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts"],
            limit: 100,
          })).items.map((work) => ({ id: work.id, number: work.number, problem: work.problem, categoryKey: work.categoryKey }))
        : []);
  const eligibleWorkOrders = await Promise.all(sourceWork.map(async (work): Promise<EligibleWorkOrderView> => {
    const record = await repository.getWorkOrder(organizationId, work.id);
    const detail = await repository.getWorkOrderDetail(scope, work.id);
    return {
      id: work.id,
      number: work.number,
      priority: displayPriority(record?.priority ?? "routine"),
      problem: work.problem,
      category: titleCase(work.categoryKey),
      asset: detail?.asset ? `${detail.asset.name} · ${detail.asset.assetTag}` : undefined,
      issuedAt: access.kind === "service" && work.id === access.serviceAuthorization.workOrderId
        ? access.serviceAuthorization.issuedAt
        : record?.createdAt ?? now(),
    };
  }));
  // Generic QR and service links never disclose another technician's active
  // visit identifier. A visit-bound link exposes one visit; a trusted store
  // device exposes only the selected provider's active visits at that store.
  const activeVisits: ActiveVisitView[] = access.kind === "visit"
    ? [{
        id: access.activeVisit.id,
        technicianName: access.activeVisit.technicianName,
        vendorName: access.activeVisit.vendorName,
        workOrderNumber: access.activeVisit.workOrderNumber,
        noWorkOrderReason: access.activeVisit.unmatchedReason,
        checkedInAt: access.activeVisit.checkedInAt,
        startedVia: access.activeVisit.startedChannel,
        checkInLocationLabel: locationResultLabel(access.activeVisit.checkInLocationResult, store.storeNumber),
      }]
    : access.kind === "trusted_store"
      ? access.trustedStore.activeVisits
          .filter((visit) => visit.providerKind === "outside_vendor" && visit.vendorId === vendorId)
          .map((visit) => ({
            id: visit.id,
            technicianName: visit.technicianName,
            vendorName: visit.providerName,
            workOrderNumber: visit.workOrderNumber,
            noWorkOrderReason: visit.unmatchedReason,
            checkedInAt: visit.checkedInAt,
            startedVia: visit.startedChannel,
            checkInLocationLabel: visit.startedChannel === "store_device"
              ? "Recorded on a trusted store device"
              : "Original check-in evidence is preserved with this visit",
          }))
      : [];
  return { vendorId, vendorName: vendor.name, eligibleWorkOrders, activeVisits };
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
  const token = await stableCheckoutToken(input.accessToken, input.submissionKey);
  const capability = await repository.getVisitByCheckoutToken({
    tokenHash: await hashOpaqueToken(token),
    purpose: "active_visit",
    now: now(),
  });
  if (!capability || capability.visit.organizationId !== visit.organizationId || capability.visit.id !== visit.id) {
    throw new PublicWorkflowError("The prior checkout link is unavailable.", 409, "idempotency_result_unavailable");
  }
  return { token, expiresAt: capability.expiresAt };
}

function checkInReceipt(input: {
  visit: VisitSession;
  organizationName: string;
  workOrderNumber?: string;
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
    workOrderNumber: input.workOrderNumber,
    checkedInAt: input.visit.checkedInAt,
    checkoutUrl: `/public/store/${encodeURIComponent(input.checkoutToken)}/visit`,
    checkoutExpiresAt: input.checkoutExpiresAt,
    location: input.location,
  };
}

function checkOutReceipt(input: {
  visit: VisitSession;
  store: Store;
  outcome: VisitOutcome;
  location: LocationEvidenceReceipt;
  evidenceReceived: number;
  evidenceStorageLabel?: string;
  replayed?: boolean;
}): TechnicianCheckOutReceipt {
  const durationMinutes = Math.max(0, Math.round((input.visit.observedDurationSeconds ?? 0) / 60));
  const followUp = input.visit.workOrderId ? followUpForOutcome(input.outcome, input.visit.providerName) : undefined;
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
    outcomeLabel: outcomeLabel(input.outcome),
    evidenceReceived: input.evidenceReceived,
    evidenceStorageLabel: input.evidenceStorageLabel,
    location: input.location,
    followUpLabel: followUp ? `${followUp.accountableParty} now owns: ${followUp.nextAction}.` : undefined,
  };
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
      },
      service: {
        problem: source.problem,
        requestedWork: source.authorizedScope ?? "Diagnose the reported problem and communicate findings before expanding the scope.",
        category: titleCase(source.categoryKey),
        asset: source.asset ? `${source.asset.name} · ${source.asset.assetTag}` : undefined,
        accessNotes: source.store.accessNotes,
      },
      authorization: {
        notToExceedLabel: source.nte ? moneyLabel(source.nte.amountMinor, source.nte.currency) : undefined,
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
      selected: "Selected for authorization",
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
      requestKindLabel: source.kind === "diagnostic_and_estimate"
        ? "Bid request - onsite diagnosis requires separate authorization"
        : "Bid request - pricing only",
      requestedAt: source.requestedAt,
      dueAt: source.dueAt,
      store: {
        number: resolved.store.storeNumber,
        name: resolved.store.name,
        address: [resolved.store.address1, resolved.store.address2, `${resolved.store.city}, ${resolved.store.state} ${resolved.store.postalCode}`].filter(Boolean).join(", "),
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
    return getContextFromAccess(access, vendorId);
  },

  async checkIn(token, command) {
    const access = await resolvePublicAccess(token);
    if (!access) throw new PublicWorkflowError("This store link is unavailable.", 404, "link_unavailable");
    if (access.kind === "visit") throw new PublicWorkflowError("A checkout link cannot start another visit.", 403, "action_not_allowed");
    const repository = runtime().repository;
    const submissionKey = cleanSubmissionKey(command.submissionKey);
    const vendorId = cleanRequired(command.vendorId, "Vendor", 100);
    const workOrderId = cleanOptional(command.workOrderId, 120);
    const technicianName = cleanRequired(command.technicianName, "Technician name", 100);
    const unmatchedReason = workOrderId ? undefined : cleanRequired(command.noWorkOrderReason ?? "", "Reason for visit", 500);
    const organizationId = accessOrganizationId(access);
    const storeView = accessStore(access);
    const store = await repository.getStore(organizationId, storeView.id);
    if (!store) throw new PublicWorkflowError("This store is unavailable.", 404, "store_unavailable");
    const location = access.kind === "trusted_store" ? trustedStoreLocation() : evaluateLocation(store, command.location);
    const requestHash = await hashRequest({
      version: 1,
      tokenHash: access.tokenHash,
      organizationId,
      storeId: store.id,
      channel: access.channel,
      vendorId,
      workOrderId: workOrderId ?? null,
      unmatchedReason: unmatchedReason ?? null,
      technicianName,
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
        || prior.vendorId !== vendorId
        || prior.workOrderId !== workOrderId
        || prior.technicianName !== technicianName
      ) {
        throw new PublicWorkflowError("The prior visit receipt does not match this store action.", 409, "idempotency_result_mismatch");
      }
      const workOrder = prior.workOrderId ? await repository.getWorkOrder(organizationId, prior.workOrderId) : null;
      const checkout = await replayCheckoutCapability({ repository, visit: prior, accessToken: token, submissionKey });
      return checkInReceipt({
        visit: prior,
        organizationName: accessOrganizationName(access),
        workOrderNumber: workOrder?.number,
        checkoutToken: checkout.token,
        checkoutExpiresAt: checkout.expiresAt,
        location: access.kind === "trusted_store" ? trustedStoreLocation(prior.checkedInAt).receipt : location.receipt,
        replayed: true,
      });
    };

    const replayed = await replayPrior();
    if (replayed) return replayed;

    const context = await getContextFromAccess(access, vendorId);
    const selectedWork = workOrderId ? context.eligibleWorkOrders.find((work) => work.id === workOrderId) : undefined;
    if (workOrderId && !selectedWork) throw new PublicWorkflowError("That work order is not available to the selected vendor.", 403, "work_order_not_eligible");
    try {
      const checkoutToken = await stableCheckoutToken(token, submissionKey);
      const checkoutExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const result = await checkInVisitWithCheckoutToken({ repository }, {
        organizationId,
        storeId: store.id,
        vendorId,
        workOrderId: selectedWork?.id,
        unmatchedReason,
        technicianName,
        purpose: selectedWork?.problem ?? unmatchedReason!,
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
        workOrderNumber: selectedWork?.number,
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
    const vendorId = cleanRequired(command.vendorId, "Vendor", 100);
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
      if (visitId !== access.activeVisit.id || vendorId !== access.activeVisit.vendorId) {
        throw new PublicWorkflowError("That visit does not match this secure checkout link.", 403, "visit_not_available");
      }
    } else if (tokenVisit && (
      tokenVisit.id !== visitId
      || tokenVisit.providerKind !== "outside_vendor"
      || tokenVisit.vendorId !== vendorId
    )) {
      throw new PublicWorkflowError("That visit does not match this secure checkout link.", 403, "visit_not_available");
    }

    const visit = await repository.getVisit(organizationId, visitId);
    if (!visit || visit.storeId !== storeId || visit.providerKind !== "outside_vendor" || visit.vendorId !== vendorId) {
      throw new PublicWorkflowError("That visit is not available from this store link.", 403, "visit_not_available");
    }
    const store = await repository.getStore(organizationId, storeId);
    if (!store) throw new PublicWorkflowError("This store is unavailable.", 404, "store_unavailable");
    const location = access?.kind === "trusted_store" ? trustedStoreLocation() : evaluateLocation(store, command.location);
    const outcomeNotes = cleanOptional(command.outcomeNotes, 2000);
    const evidence = await Promise.all(command.evidence.map(async (upload) => ({
      name: upload.name,
      mediaType: upload.mediaType,
      size: upload.size,
      sha256: await hashUpload(upload),
    })));
    const requestHash = await hashRequest({
      version: 1,
      tokenHash,
      organizationId,
      storeId,
      vendorId,
      visitId,
      outcome: command.outcome,
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
      if (prior.status !== "checked_out" || !prior.checkedOutAt || prior.outcome !== command.outcome) {
        throw new PublicWorkflowError("The prior checkout result is unavailable.", 409, "idempotency_result_unavailable");
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
        && candidate.vendorId === vendorId
      ));
      if (!trustedVisit) {
        throw new PublicWorkflowError("That active visit is not available on this store device.", 403, "visit_not_available");
      }
    }

    const followUp = visit.workOrderId ? followUpForOutcome(command.outcome, visit.providerName) : undefined;
    try {
      const checkoutActor: ActorContext = access.kind === "trusted_store"
        ? { actorType: "store_device", actorName: `Store ${store.storeNumber} service desk`, organizationId }
        : { actorType: "technician", actorName: visit.technicianName, organizationId };
      const completed = await checkOutVisit({ repository }, {
        organizationId,
        visitId: visit.id,
        channel: access.channel,
        outcome: command.outcome as OpsVisitOutcome,
        outcomeNotes,
        location: location.observation,
        followUp,
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
    const organizationId = accessOrganizationId(access);
    const storeView = accessStore(access);
    const reporterName = cleanRequired(command.reporterName, "Your name", 100);
    const problem = cleanRequired(command.problem, "Problem description", 2000);
    const employeeId = cleanOptional(command.employeeId, 80);
    const area = cleanOptional(command.area, 120);
    const storedProblem = area ? `Area or equipment: ${area}\n\n${problem}` : problem;
    const priority = command.urgency === "urgent_safety" ? "emergency" : command.urgency === "priority" ? "urgent" : "routine";
    try {
      const request = await createServiceRequest({ repository: runtime().repository }, {
        organizationId,
        storeId: storeView.id,
        reporterName,
        reporterEmployeeId: employeeId,
        problem: storedProblem,
        priority,
        actor: { actorType: "store_device", actorName: reporterName, organizationId },
      });
      const uploadActor: ActorContext = { actorType: "store_device", actorName: reporterName, organizationId };
      const uploads = await receiveUploads({
        organizationId,
        subjectType: "request",
        subjectId: request.id,
        uploads: command.evidence,
        visibility: "internal",
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
        evidenceStorageLabel: uploads.label,
        nextStep: command.urgency === "urgent_safety"
          ? "The report is marked as a safety or shutdown concern. Follow store emergency procedures now; this form does not replace emergency services."
          : "The store manager will review the report and decide the next action. The original report remains in the record.",
      };
    } catch (error) {
      return publicDomainError(error);
    }
  },
};

export function getPublicOperationsGateway(): PublicOperationsGateway {
  // All public channels resolve a purpose-bound token, then invoke the same
  // lib/ops repository and domain commands used by authenticated operator UI.
  return gateway;
}
