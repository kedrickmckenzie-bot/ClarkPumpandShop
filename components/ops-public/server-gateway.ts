import {
  attachPublicEvidence,
  checkInVisitWithCheckoutToken,
  checkOutVisit,
  createServiceRequest,
  OpsDomainError,
  recordVendorResponse,
} from "@/lib/ops/commands";
import { NORTHLINE_DEMO_ENTRY_TOKENS } from "@/lib/ops/fixtures";
import type { OpsRepository } from "@/lib/ops/repository";
import { getServerOpsRepositoryProxy } from "@/lib/server/ops-repository-provider";
import type { ActorContext, LocationObservation, Store, VendorResponseKind, VisitChannel, VisitOutcome as OpsVisitOutcome } from "@/lib/ops/types";
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
  TechnicianCheckOutReceipt,
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

function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

function trustedStoreLocation(): { observation: LocationObservation; receipt: LocationEvidenceReceipt } {
  const capturedAt = now();
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
  const facilitiesOwned = outcome === "unable_to_complete" || outcome === "other";
  return {
    accountableParty: facilitiesOwned ? "Facilities coordinator" : providerName,
    nextAction: outcome === "diagnosed_waiting_parts"
      ? "Provide parts ETA and schedule the return visit"
      : outcome === "temporary_repair"
        ? "Review permanent repair plan and schedule follow-up"
        : outcome === "return_required"
          ? "Schedule the required return visit"
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
  actor: ActorContext;
}): Promise<{ received: number; attached: number; label?: string }> {
  if (!input.uploads.length) return { received: 0, attached: 0 };
  try {
    const results = await getPublicUploadStore().store(input);
    let attached = 0;
    for (const stored of results.filter((result) => result.stored)) {
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
        // The core visit or request receipt remains valid. The explicit storage
        // label below keeps a partial attachment result from being hidden.
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

  async respondToServiceAuthorization(token, command) {
    const resolved = await resolveServiceAuthorization(token);
    if (!resolved) throw new PublicWorkflowError("This service link is unavailable.", 404, "link_unavailable");
    const source = resolved.view;
    if (source.latestResponse && ["accepted", "declined"].includes(source.latestResponse.response)) {
      throw new PublicWorkflowError("A final response has already been recorded for this authorization.", 409, "response_already_recorded");
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
    const context = await getContextFromAccess(access, command.vendorId);
    const technicianName = cleanRequired(command.technicianName, "Technician name", 100);
    const selectedWork = command.workOrderId ? context.eligibleWorkOrders.find((work) => work.id === command.workOrderId) : undefined;
    if (command.workOrderId && !selectedWork) throw new PublicWorkflowError("That work order is not available to the selected vendor.", 403, "work_order_not_eligible");
    const unmatchedReason = command.workOrderId ? undefined : cleanRequired(command.noWorkOrderReason ?? "", "Reason for visit", 500);
    const organizationId = accessOrganizationId(access);
    const storeView = accessStore(access);
    const store = await runtime().repository.getStore(organizationId, storeView.id);
    if (!store) throw new PublicWorkflowError("This store is unavailable.", 404, "store_unavailable");
    const location = access.kind === "trusted_store" ? trustedStoreLocation() : evaluateLocation(store, command.location);
    try {
      const checkoutToken = generateOpaqueToken();
      const checkoutExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const result = await checkInVisitWithCheckoutToken({ repository: runtime().repository }, {
        organizationId,
        storeId: store.id,
        vendorId: command.vendorId,
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
      });
      const visit = result.visit;
      return {
        receiptId: `receipt-${visit.id}`,
        receivedAt: visit.checkedInAt,
        mode: runtime().mode,
        heading: "You are checked in",
        message: `${accessOrganizationName(access)} received this visit for ${context.vendorName}.`,
        visitId: visit.id,
        vendorName: context.vendorName,
        technicianName,
        workOrderNumber: selectedWork?.number,
        checkedInAt: visit.checkedInAt,
        checkoutUrl: `/public/store/${encodeURIComponent(checkoutToken)}/visit`,
        checkoutExpiresAt,
        location: location.receipt,
      };
    } catch (error) {
      return publicDomainError(error);
    }
  },

  async checkOut(token, command) {
    const access = await resolvePublicAccess(token);
    if (!access) throw new PublicWorkflowError("This store link is unavailable.", 404, "link_unavailable");
    if (access.kind !== "visit" && access.kind !== "trusted_store") {
      throw new PublicWorkflowError("Use the secure checkout link from the check-in receipt to finish this visit.", 403, "visit_token_required");
    }
    const organizationId = accessOrganizationId(access);
    const storeView = accessStore(access);
    if (access.kind === "visit") {
      if (command.visitId !== access.activeVisit.id || command.vendorId !== access.activeVisit.vendorId) {
        throw new PublicWorkflowError("That visit does not match this secure checkout link.", 403, "visit_not_available");
      }
    } else {
      const trustedVisit = access.trustedStore.activeVisits.find((candidate) => (
        candidate.id === command.visitId
        && candidate.providerKind === "outside_vendor"
        && candidate.vendorId === command.vendorId
      ));
      if (!trustedVisit) {
        throw new PublicWorkflowError("That active visit is not available on this store device.", 403, "visit_not_available");
      }
    }
    const visit = await runtime().repository.getVisit(organizationId, command.visitId);
    if (!visit || visit.storeId !== storeView.id || visit.vendorId !== command.vendorId || visit.status !== "active") {
      throw new PublicWorkflowError("That active visit is not available from this store link.", 403, "visit_not_available");
    }
    const store = await runtime().repository.getStore(organizationId, storeView.id);
    if (!store) throw new PublicWorkflowError("This store is unavailable.", 404, "store_unavailable");
    const location = access.kind === "trusted_store" ? trustedStoreLocation() : evaluateLocation(store, command.location);
    const outcomeNotes = cleanOptional(command.outcomeNotes, 2000);
    const followUp = visit.workOrderId ? followUpForOutcome(command.outcome, visit.providerName) : undefined;
    try {
      const checkoutActor: ActorContext = access.kind === "trusted_store"
        ? { actorType: "store_device", actorName: `Store ${store.storeNumber} service desk`, organizationId }
        : { actorType: "technician", actorName: visit.technicianName, organizationId };
      const completed = await checkOutVisit({ repository: runtime().repository }, {
        organizationId,
        visitId: visit.id,
        channel: access.channel,
        outcome: command.outcome as OpsVisitOutcome,
        outcomeNotes,
        location: location.observation,
        followUp,
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
        actor: uploadActor,
      });
      const durationMinutes = Math.max(0, Math.round((completed.observedDurationSeconds ?? 0) / 60));
      const result: TechnicianCheckOutReceipt = {
        receiptId: `receipt-${visit.id}-checkout`,
        receivedAt: completed.checkedOutAt!,
        mode: runtime().mode,
        heading: "Checkout received",
        message: `${visit.technicianName} is checked out of Store ${store.storeNumber}.`,
        visitId: visit.id,
        checkedOutAt: completed.checkedOutAt!,
        observedDurationMinutes: durationMinutes,
        observedDurationLabel: `${durationMinutes} minutes of approximate observed onsite time`,
        outcomeLabel: outcomeLabel(command.outcome),
        evidenceReceived: uploads.received,
        evidenceStorageLabel: uploads.label,
        location: location.receipt,
        followUpLabel: followUp ? `${followUp.accountableParty} now owns: ${followUp.nextAction}.` : undefined,
      };
      return result;
    } catch (error) {
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
