"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileBarChart,
  FileText,
  Gauge,
  LayoutDashboard,
  MapPin,
  PackageSearch,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Store as StoreIcon,
  Truck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { demoData } from "@/lib/cstore/demo-data";
import { findLifecycleCandidates } from "@/lib/cstore/analytics";
import {
  demoRolePolicies,
  getDemoRolePolicy,
  roleScopeLabel,
  scopeDatasetForRole,
  type DemoRoleId,
  type RolePermission,
  type RoleView,
} from "@/lib/cstore/role-policy";
import type {
  Asset,
  AuditEvent,
  DemoDataset,
  ExceptionRecord,
  Store,
  Vendor,
  VendorIssuance,
  Visit,
  WorkAssignment,
  WorkOrder,
  WorkStatus,
} from "@/lib/cstore/types";
import { TechnicianVisitFlow } from "./technician-visit-flow";
import { GuidedStoreSetup } from "./guided-store-setup";
import { WorkClassificationEditor } from "./work-classification-editor";
import { WorkOrderCreation } from "./work-order-creation";
import type { GuidedStoreSetupValue, WorkClassificationValue } from "./setup-workflows";
import { VendorServiceAuthorization } from "./vendor-service-authorization";
import type {
  ActiveVisit,
  ServiceAuthorizationRecord,
  StoreOption,
  VisitChannel as WorkflowVisitChannel,
  VisitCheckInValue,
  VisitCheckOutValue,
  VisitEvidence,
  VendorOption,
  WorkOrderCreationValue,
} from "./types";

type View = RoleView;
type Drawer = "create-work" | "issue-vendor" | "store-portal" | "visit" | "capabilities" | "new-store" | "classify-work" | null;
type Detail = { kind: "store" | "work" | "vendor" | "asset"; id: string } | null;
interface CapabilityConfig {
  vendorAcceptance: boolean;
  locationEvidence: boolean;
  invoiceSafeguard: boolean;
  preventiveMaintenance: boolean;
  equipmentLifecycle: boolean;
}

const navItems: Array<{ view: View; label: string; icon: typeof LayoutDashboard }> = [
  { view: "today", label: "Today", icon: LayoutDashboard },
  { view: "stores", label: "Stores", icon: StoreIcon },
  { view: "work", label: "Work", icon: ClipboardList },
  { view: "vendors", label: "Vendors", icon: Truck },
  { view: "spend", label: "Spend", icon: CircleDollarSign },
  { view: "equipment", label: "Equipment", icon: Gauge },
  { view: "pm", label: "Preventive maintenance", icon: CalendarCheck },
  { view: "reports", label: "Reports", icon: FileBarChart },
];

const terminalStatuses = new Set<WorkStatus>(["closed", "cancelled"]);

function money(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function dateLabel(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}

function timeLabel(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function words(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string): "red" | "amber" | "green" | "blue" | "teal" | "" {
  if (["emergency", "unresolved", "declined", "overdue", "critical"].includes(status)) return "red";
  if (["urgent", "waiting_parts", "awaiting_vendor_response", "needs_review", "warning"].includes(status)) return "amber";
  if (["completed", "closed", "accepted", "approved", "preferred"].includes(status)) return "green";
  if (["onsite", "scheduled", "issued", "active"].includes(status)) return "blue";
  if (["open", "ready_to_issue", "invoice_received"].includes(status)) return "teal";
  return "";
}

function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`to-badge ${statusTone(value)}`}>{label ?? words(value)}</span>;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function invoiceTotal(dataset: DemoDataset, invoiceId: string) {
  const invoice = dataset.invoices.find((record) => record.id === invoiceId);
  return invoice?.lineItems.reduce((sum, line) => sum + line.amountMinor, 0) ?? 0;
}

function workOrderCost(dataset: DemoDataset, workOrderId: string) {
  const linked = dataset.invoiceWorkLinks
    .filter((link) => link.workOrderId === workOrderId)
    .reduce((sum, link) => sum + link.attributedAmountMinor, 0);
  if (linked) return linked;
  return dataset.costLines
    .filter((line) => line.workOrderId === workOrderId && line.basis === "recorded")
    .reduce((sum, line) => sum + line.amountMinor, 0);
}

function storeSpend(dataset: DemoDataset, storeId: string) {
  return dataset.invoiceWorkLinks
    .filter((link) => link.storeId === storeId)
    .reduce((sum, link) => sum + link.attributedAmountMinor, 0);
}

function categorySpend(dataset: DemoDataset, categoryId: string) {
  return dataset.invoiceWorkLinks
    .filter((link) => link.categoryId === categoryId)
    .reduce((sum, link) => sum + link.attributedAmountMinor, 0);
}

function vendorSpend(dataset: DemoDataset, vendorId: string) {
  const invoiceIds = new Set(dataset.invoices.filter((invoice) => invoice.vendorId === vendorId).map((invoice) => invoice.id));
  return dataset.invoiceWorkLinks
    .filter((link) => invoiceIds.has(link.invoiceId))
    .reduce((sum, link) => sum + link.attributedAmountMinor, 0);
}

function workForStore(dataset: DemoDataset, storeId: string) {
  return dataset.workOrders.filter((work) => work.storeId === storeId);
}

function facilitiesOwner(dataset: DemoDataset) {
  return dataset.people.find((person) => person.roles.includes("facilities_manager")) ?? dataset.people[0];
}

function domainVisitChannel(channel: WorkflowVisitChannel): Visit["channelStarted"] {
  return channel === "app"
    ? "vendor_app"
    : channel === "qr"
      ? "qr_mobile_web"
      : channel === "store_kiosk"
        ? "store_kiosk"
        : "secure_work_link";
}

function domainVisitEvidence(evidence: VisitEvidence): Pick<Visit, "evidenceStrength" | "locationEvidence"> {
  const locationVerified = evidence.state === "location_verified";
  const kioskRecorded = evidence.state === "store_kiosk_recorded";
  return {
    evidenceStrength: locationVerified
      ? "location_verified"
      : kioskRecorded
        ? "store_kiosk"
        : "manual_unverified",
    locationEvidence: {
      required: !kioskRecorded,
      consented: locationVerified || evidence.state === "outside_geofence",
      capturedAt: evidence.capturedAt,
      accuracyMeters: evidence.accuracyMeters,
      distanceFromStoreMeters: evidence.distanceMeters,
      verification: locationVerified
        ? "inside_geofence"
        : evidence.state === "outside_geofence"
          ? "outside_geofence"
          : "not_collected",
    },
  };
}

function domainVisitOutcome(outcome: VisitCheckOutValue["outcome"]): NonNullable<Visit["outcome"]> {
  if (outcome === "preventive_service_complete") return "preventive_complete";
  if (outcome === "return_visit_required") return "unresolved";
  return outcome;
}

function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="to-page-head">
      <div>
        <p className="to-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children ? <div className="to-head-actions">{children}</div> : null}
    </header>
  );
}

export function TraceOpsApp() {
  const [view, setView] = useState<View>("today");
  const [detail, setDetail] = useState<Detail>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [roleId, setRoleId] = useState<DemoRoleId>("facilities_manager");
  const [globalQuery, setGlobalQuery] = useState("");
  const [stores, setStores] = useState<Store[]>(demoData.stores);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(demoData.workOrders);
  const [assignments, setAssignments] = useState<WorkAssignment[]>(demoData.assignments);
  const [issuances, setIssuances] = useState<VendorIssuance[]>(demoData.vendorIssuances);
  const [visits, setVisits] = useState<Visit[]>(demoData.visits);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>(demoData.exceptions);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(demoData.auditEvents);
  const [pendingAuthorization, setPendingAuthorization] = useState<ServiceAuthorizationRecord | null>(null);
  const [visitStoreId, setVisitStoreId] = useState<string | null>(null);
  const [workInitialStoreId, setWorkInitialStoreId] = useState<string | null>(null);
  const [classificationWorkId, setClassificationWorkId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<string[]>([]);
  const [draftAcceptanceByWork, setDraftAcceptanceByWork] = useState<Record<string, boolean>>({});
  const [capabilities, setCapabilities] = useState<CapabilityConfig>({
    vendorAcceptance: true,
    locationEvidence: true,
    invoiceSafeguard: true,
    preventiveMaintenance: true,
    equipmentLifecycle: true,
  });

  const fullDataset = useMemo<DemoDataset>(
    () => ({
      ...demoData,
      stores,
      workOrders,
      assignments,
      vendorIssuances: issuances,
      visits,
      exceptions,
      auditEvents,
    }),
    [assignments, auditEvents, exceptions, issuances, stores, visits, workOrders],
  );

  const rolePolicy = getDemoRolePolicy(roleId);
  const dataset = useMemo(
    () => scopeDatasetForRole(fullDataset, rolePolicy),
    [fullDataset, rolePolicy],
  );
  const activePerson = fullDataset.people.find((person) => person.id === rolePolicy.personId) ?? fullDataset.people[0];
  const scopeLabel = roleScopeLabel(fullDataset, rolePolicy);

  const activeVisits = dataset.visits.filter((visit) => !visit.checkedOutAt);
  const openWork = dataset.workOrders.filter((work) => !terminalStatuses.has(work.status));
  const openExceptions = dataset.exceptions.filter((record) => record.status !== "resolved");
  const invoicedSpend = dataset.invoiceWorkLinks.reduce((sum, link) => sum + link.attributedAmountMinor, 0);
  const classificationWork = classificationWorkId
    ? dataset.workOrders.find((record) => record.id === classificationWorkId)
    : undefined;
  const classificationStore = classificationWork
    ? dataset.stores.find((record) => record.id === classificationWork.storeId)
    : undefined;
  const roleNavItems = navItems.filter((item) => rolePolicy.allowedViews.includes(item.view));
  const intelligenceNavItems = roleNavItems.slice().filter((item) => ["spend", "equipment", "pm", "reports"].includes(item.view)).filter((item) =>
    item.view === "equipment"
      ? capabilities.equipmentLifecycle
      : item.view === "pm"
        ? capabilities.preventiveMaintenance
        : true,
  );
  const mobileNavItems = roleNavItems
    .filter((item) => item.view !== "equipment" || capabilities.equipmentLifecycle)
    .filter((item) => item.view !== "pm" || capabilities.preventiveMaintenance)
    .slice(0, 5);

  const storeOptions: StoreOption[] = dataset.stores.map((store) => ({
    id: store.id,
    storeNumber: store.storeNumber,
    name: store.name,
    address: `${store.address.line1}, ${store.address.city}, ${store.address.state}`,
    regionName: dataset.regions.find((region) => region.id === store.regionId)?.name,
  }));

  const vendorOptions: VendorOption[] = dataset.vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.displayName,
    description: vendor.description,
    specialties: vendor.specialties.map((specialty) => specialty.label),
    aliases: [...vendor.aliases, ...vendor.searchTerms],
    coverage: vendor.coverageRegionIds.map(
      (regionId) => dataset.regions.find((region) => region.id === regionId)?.name ?? "Regional coverage",
    ),
    coveredStoreIds: dataset.stores
      .filter((store) => store.regionId && vendor.coverageRegionIds.includes(store.regionId))
      .map((store) => store.id),
    preferredStoreIds: vendor.preferredStoreIds,
    dispatchEmail: vendor.contacts.find((contact) => contact.role === "dispatch")?.email,
    dispatchPhone: vendor.contacts.find((contact) => contact.role === "dispatch")?.phone,
    afterHoursLabel: vendor.afterHoursAvailable ? "24/7 emergency dispatch" : "Standard dispatch hours",
  }));

  const searchResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    const stores = dataset.stores
      .filter((store) =>
        [store.storeNumber, store.name, store.normalizedAddress, ...store.searchTerms, ...store.aliases.map((a) => a.value)]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 4)
      .map((store) => ({ kind: "store" as const, id: store.id, title: `Store ${store.storeNumber}`, meta: store.normalizedAddress }));
    const vendors = rolePolicy.allowedViews.includes("vendors") ? dataset.vendors
      .filter((vendor) =>
        [vendor.displayName, vendor.description, ...vendor.aliases, ...vendor.searchTerms]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 3)
      .map((vendor) => ({ kind: "vendor" as const, id: vendor.id, title: vendor.displayName, meta: vendor.specialties.map((s) => s.label).join(" · ") })) : [];
    const work = rolePolicy.allowedViews.includes("work") ? dataset.workOrders
      .filter((record) => [record.number, record.title, record.problemDescription].join(" ").toLowerCase().includes(query))
      .slice(0, 4)
      .map((record) => ({ kind: "work" as const, id: record.id, title: record.number, meta: record.title })) : [];
    const assets = rolePolicy.allowedViews.includes("equipment") ? dataset.assets
      .filter((asset) =>
        [asset.assetCode, asset.name, asset.manufacturer, asset.model, asset.serialNumber, ...asset.searchTerms]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 3)
      .map((asset) => ({
        kind: "asset" as const,
        id: asset.id,
        title: asset.name,
        meta: `${asset.assetCode} · ${asset.manufacturer} ${asset.model}`,
      })) : [];
    return [...stores, ...vendors, ...work, ...assets].slice(0, 8);
  }, [dataset.assets, dataset.stores, dataset.vendors, dataset.workOrders, globalQuery, rolePolicy]);

  function navigate(next: View) {
    if (!rolePolicy.allowedViews.includes(next)) {
      setNotice(`${rolePolicy.label} does not have access to ${navItems.find((item) => item.view === next)?.label ?? next}.`);
      return;
    }
    setView(next);
    setDetail(null);
    setGlobalQuery("");
  }

  function hasPermission(permission: RolePermission) {
    return rolePolicy.permissions[permission];
  }

  function guardPermission(permission: RolePermission, action: string) {
    if (hasPermission(permission)) return true;
    setNotice(`${rolePolicy.label} has read-only access here and cannot ${action}.`);
    return false;
  }

  function changeRole(nextRoleId: DemoRoleId) {
    const nextPolicy = getDemoRolePolicy(nextRoleId);
    setRoleId(nextRoleId);
    setView(nextPolicy.defaultView);
    setDetail(null);
    setDrawer(null);
    setPendingAuthorization(null);
    setClassificationWorkId(null);
    setWorkInitialStoreId(null);
    setVisitStoreId(null);
    setGlobalQuery("");
    const nextPerson = fullDataset.people.find((person) => person.id === nextPolicy.personId);
    setNotice(`Now viewing as ${nextPerson?.displayName ?? nextPolicy.label} · ${roleScopeLabel(fullDataset, nextPolicy)}.`);
  }

  function openWorkOrderDrawer(storeId?: string) {
    if (!guardPermission("createWork", "create work orders")) return;
    if (storeId && !dataset.stores.some((store) => store.id === storeId)) {
      setNotice("That store is outside this role’s assigned scope.");
      return;
    }
    setWorkInitialStoreId(storeId ?? null);
    setDrawer("create-work");
  }

  function openResult(result: { kind: "store" | "vendor" | "work" | "asset"; id: string }) {
    setView(
      result.kind === "store"
        ? "stores"
        : result.kind === "vendor"
          ? "vendors"
          : result.kind === "asset"
            ? "equipment"
            : "work",
    );
    setDetail(result);
    setGlobalQuery("");
  }

  function appendAuditEvent(
    entityType: AuditEvent["entityType"],
    entityId: string,
    summary: string,
    payloadSnapshot: AuditEvent["payloadSnapshot"],
    channel: AuditEvent["channel"] = "manager_web",
    actorType: AuditEvent["actorType"] = "person",
  ) {
    const event: AuditEvent = {
      id: `audit-session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      organizationId: dataset.organization.id,
      entityType,
      entityId,
      eventType: summary.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      actorType,
      actorId: actorType === "person" ? activePerson?.id : undefined,
      channel,
      occurredAt: new Date().toISOString(),
      summary,
      payloadSnapshot,
      demoMode: true,
    };
    setAuditEvents((current) => [event, ...current]);
  }

  function createStore(value: GuidedStoreSetupValue) {
    if (!guardPermission("createStore", "create stores")) return;
    const manager = dataset.people.find((person) => person.roles.includes("store_manager")) ?? dataset.people[0];
    if (!manager) return;
    const regionStore = dataset.stores.find((record) => record.regionId === value.regionId);
    const store: Store = {
      id: `store-session-${Date.now()}`,
      organizationId: dataset.organization.id,
      divisionId: dataset.divisions[0]?.id,
      regionId: value.regionId,
      storeNumber: value.storeNumber,
      name: value.name,
      normalizedAddress: `${value.address.line1}, ${value.address.city}, ${value.address.state} ${value.address.postalCode}`,
      address: value.address,
      coordinates: regionStore?.coordinates ?? { latitude: 39.5, longitude: -84.5 },
      externalIdentifiers: { demo_setup: `NEW-${value.storeNumber}` },
      aliases: [],
      phone: "(555) 010-0199",
      managerPersonId: manager.id,
      format: value.format,
      open24Hours: value.hours.mode === "open_24_hours",
      openedOn: dataset.asOf.slice(0, 10),
      squareFeet: value.format === "travel_center" ? 7200 : value.format === "market_only" ? 2800 : 4100,
      activeCategoryIds: value.starterCategoryIds,
      status: "open",
      searchTerms: [value.storeNumber, value.name, value.address.line1, value.address.city],
    };
    setStores((current) => [store, ...current]);
    setDrawer(null);
    setView("stores");
    setDetail({ kind: "store", id: store.id });
    setNotice(`Store ${store.storeNumber} created with ${store.activeCategoryIds.length} starter service areas. Equipment and PM can be added when useful.`);
  }

  function saveWorkClassification(value: WorkClassificationValue) {
    if (!guardPermission("classifyWork", "change equipment classification")) return;
    if (!dataset.workOrders.some((work) => work.id === value.workOrderId)) {
      setNotice("That work order is outside this role’s assigned scope.");
      return;
    }
    setWorkOrders((current) =>
      current.map((record) =>
        record.id === value.workOrderId
          ? {
              ...record,
              categoryId: value.categoryId,
              taxonomyNodeId: value.taxonomyNodeId,
              assetId: value.assetId,
              componentId: value.componentId,
              classificationDeferred: value.classificationDeferred,
            }
          : record,
      ),
    );
    appendAuditEvent("work_order", value.workOrderId, "Maintenance classification updated", {
      workOrderId: value.workOrderId,
      categoryId: value.categoryId ?? null,
      taxonomyNodeId: value.taxonomyNodeId ?? null,
      assetId: value.assetId ?? null,
      componentId: value.componentId ?? null,
      classificationDeferred: value.classificationDeferred,
    });
    setDrawer(null);
    setClassificationWorkId(null);
    setDetail({ kind: "work", id: value.workOrderId });
    setNotice(value.classificationDeferred ? "Current classification saved. Deeper equipment detail remains optional." : "Work order classified through the selected equipment level.");
  }

  function createWorkOrder(value: WorkOrderCreationValue) {
    if (!guardPermission("createWork", "create work orders")) return;
    const store = dataset.stores.find((record) => record.id === value.storeId);
    if (!store) return;
    const creator = activePerson;
    if (!creator) return;
    const sequence = String(300 + workOrders.length + 1).padStart(6, "0");
    const now = new Date(dataset.asOf);
    const due = new Date(now);
    due.setDate(due.getDate() + (value.priority === "emergency" ? 0 : value.priority === "urgent" ? 1 : 3));
    const newWork: WorkOrder = {
      id: `wo-created-${workOrders.length + 1}`,
      organizationId: dataset.organization.id,
      number: `${dataset.organization.workOrderPrefix}-${store.storeNumber}-${sequence}`,
      storeId: store.id,
      title: value.problem.length > 56 ? `${value.problem.slice(0, 53)}…` : value.problem,
      problemDescription: value.problem,
      scopeOfWork: "Diagnose the reported condition and restore safe, normal operation. Call before exceeding authorization.",
      priority: value.priority,
      source: "manager_direct",
      fulfillmentMode: value.fulfillmentMode === "decide_later" ? "unassigned" : value.fulfillmentMode,
      status:
        value.fulfillmentMode === "external"
          ? "ready_to_issue"
          : "draft",
      createdByPersonId: creator.id,
      createdAt: dataset.asOf,
      requestedWindow: { startsAt: dataset.asOf, endsAt: due.toISOString() },
      accountable: {
        partyType:
          value.fulfillmentMode === "internal" && value.internalTeamId
            ? "team"
            : value.fulfillmentMode === "external"
              ? "vendor"
              : "person",
        partyId: value.internalTeamId ?? value.vendorId ?? creator.id,
        nextAction: value.fulfillmentMode === "external" ? "Issue customer work order to selected vendor" : value.fulfillmentMode === "internal" ? "Acknowledge and assess work" : "Choose internal team or outside vendor",
        dueAt: due.toISOString(),
        escalationPartyId: creator.id,
      },
      notToExceedMinor: value.fulfillmentMode === "external" ? 75000 : undefined,
      currency: "USD",
      classificationDeferred: true,
      tags: ["created-in-demo"],
    };
    setWorkOrders((current) => [newWork, ...current]);
    appendAuditEvent("work_order", newWork.id, "Customer work order created", {
      workOrderId: newWork.id,
      storeId: newWork.storeId,
      fulfillmentMode: newWork.fulfillmentMode,
      status: newWork.status,
    });

    if (value.fulfillmentMode === "external" && value.vendorId) {
      const assignment: WorkAssignment = {
        id: `assignment-created-${assignments.length + 1}`,
        organizationId: dataset.organization.id,
        workOrderId: newWork.id,
        partyType: "vendor",
        partyId: value.vendorId,
        status: "offered",
        assignedAt: dataset.asOf,
        assignmentNote: "Outside vendor selected; service authorization ready to send.",
      };
      setAssignments((current) => [assignment, ...current]);
      appendAuditEvent("assignment", assignment.id, "Outside vendor selected", {
        workOrderId: newWork.id,
        vendorId: value.vendorId,
      });
      const vendor = vendorOptions.find((record) => record.id === value.vendorId);
      const storeOption = storeOptions.find((record) => record.id === value.storeId);
      if (vendor && storeOption) {
        setPendingAuthorization({
          workOrderId: newWork.id,
          customerWorkOrderNumber: newWork.number,
          store: storeOption,
          vendor,
          problem: newWork.problemDescription,
          requestedService: newWork.scopeOfWork,
          priority: value.priority,
          requestedWindow: `${dateLabel(newWork.requestedWindow.startsAt)} – ${dateLabel(newWork.requestedWindow.endsAt)}`,
          accessInstructions: "Check in using the store QR or the store service desk before beginning work.",
          nteMinorUnits: newWork.notToExceedMinor,
          currency: "USD",
        });
        setDrawer("issue-vendor");
        return;
      }
    } else if (value.fulfillmentMode === "internal" && value.internalTeamId) {
      const internalTeamId = value.internalTeamId;
      setAssignments((current) => [
        {
          id: `assignment-created-${assignments.length + 1}`,
          organizationId: dataset.organization.id,
          workOrderId: newWork.id,
          partyType: "team",
          partyId: internalTeamId,
          status: "offered",
          assignedAt: dataset.asOf,
          assignmentNote: "Assigned to internal maintenance queue.",
        },
        ...current,
      ]);
      appendAuditEvent("assignment", `assignment-created-${assignments.length + 1}`, "Internal team selected", {
        workOrderId: newWork.id,
        teamId: internalTeamId,
      });
    }
    setDrawer(null);
    setView("work");
    setDetail({ kind: "work", id: newWork.id });
    setNotice(`${newWork.number} created.`);
  }

  function openAuthorizationForWork(workOrderId: string) {
    if (!guardPermission("issueVendorWork", "issue work to vendors")) return;
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    const assignment = dataset.assignments.find(
      (record) => record.workOrderId === workOrderId && record.partyType === "vendor" && record.status !== "declined",
    );
    const store = work ? storeOptions.find((record) => record.id === work.storeId) : undefined;
    const vendor = assignment ? vendorOptions.find((record) => record.id === assignment.partyId) : undefined;
    if (!work || !store || !vendor) {
      setNotice("Choose an outside vendor before issuing this customer work order.");
      return;
    }
    setPendingAuthorization({
      workOrderId: work.id,
      customerWorkOrderNumber: work.number,
      store,
      vendor,
      problem: work.problemDescription,
      requestedService: work.scopeOfWork,
      priority: work.priority,
      requestedWindow: `${dateLabel(work.requestedWindow.startsAt)} – ${dateLabel(work.requestedWindow.endsAt)}`,
      accessInstructions: "Check in using the store QR or the store service desk before beginning work.",
      nteMinorUnits: work.notToExceedMinor,
      currency: work.currency,
    });
    setDrawer("issue-vendor");
  }

  function issueAuthorization(value: {
    workOrderId: string;
    customerWorkOrderNumber: string;
    nteMinorUnits?: number;
    currency: string;
    sendByEmail: boolean;
    email?: string;
    sendByText: boolean;
    phone?: string;
    acceptanceRequested: boolean;
    vendorNote?: string;
  }) {
    if (!guardPermission("issueVendorWork", "issue work to vendors")) return;
    if (!pendingAuthorization) return;
    if (!dataset.workOrders.some((work) => work.id === value.workOrderId)) {
      setNotice("That work order is outside this role’s assigned scope.");
      return;
    }
    const assignment = dataset.assignments.find((record) => record.workOrderId === value.workOrderId && record.partyType === "vendor");
    const creator = activePerson;
    if (!assignment || !creator) return;
    const issuance: VendorIssuance = {
      id: `issuance-created-${issuances.length + 1}`,
      organizationId: dataset.organization.id,
      workOrderId: value.workOrderId,
      vendorId: assignment.partyId,
      assignmentId: assignment.id,
      version: 1,
      issuedAt: dataset.asOf,
      issuedByPersonId: creator.id,
      channels: [value.sendByEmail ? "email" : null, value.sendByText ? "sms" : null].filter(
        (channel): channel is "email" | "sms" => Boolean(channel),
      ),
      recipientContactIds: [],
      deliveryStatus: "delivered",
      acceptanceRequested: value.acceptanceRequested,
      customerBillingInstruction: `Include ${value.customerWorkOrderNumber} on every invoice and service document.`,
      scopeSnapshot: pendingAuthorization.requestedService ?? pendingAuthorization.problem,
      notToExceedMinor: value.nteMinorUnits,
      currency: "USD",
    };
    setIssuances((current) => [issuance, ...current]);
    setWorkOrders((current) =>
      current.map((record) =>
        record.id === value.workOrderId
          ? {
              ...record,
              status: value.acceptanceRequested ? "awaiting_vendor_response" : "issued",
              notToExceedMinor: value.nteMinorUnits,
              accountable: record.accountable
                ? {
                    ...record.accountable,
                    nextAction: value.acceptanceRequested
                      ? "Vendor must accept, decline, or propose a service date"
                      : "Vendor must perform the authorized work and record the visit",
                  }
                : record.accountable,
            }
          : record,
      ),
    );
    appendAuditEvent("vendor_issuance", issuance.id, "Customer work order delivered to vendor", {
      workOrderId: value.workOrderId,
      vendorId: assignment.partyId,
      acceptanceRequested: value.acceptanceRequested,
      channels: issuance.channels.join("+"),
    });
    setPendingAuthorization(null);
    setDrawer(null);
    setView("work");
    setDetail({ kind: "work", id: value.workOrderId });
    setNotice(`${value.customerWorkOrderNumber} delivered to ${pendingAuthorization.vendor.name}.`);
  }

  function respondToVendorWork(
    workOrderId: string,
    response: "accepted" | "declined" | "date_proposed",
  ) {
    if (!guardPermission("simulateVendorResponse", "record a vendor response")) return;
    const latest = dataset.vendorIssuances
      .filter((record) => record.workOrderId === workOrderId)
      .sort((a, b) => b.version - a.version)[0];
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    if (!latest || !work) return;
    const now = new Date().toISOString();
    const proposedArrivalAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const facilitiesOwner = dataset.people.find((person) => person.roles.includes("facilities_manager")) ?? dataset.people[0];

    setIssuances((current) =>
      current.map((record) =>
        record.id === latest.id
          ? {
              ...record,
              response,
              respondedAt: now,
              vendorReference: response === "declined" ? undefined : "SV-884219",
              proposedArrivalAt: response === "date_proposed" ? proposedArrivalAt : undefined,
            }
          : record,
      ),
    );
    setAssignments((current) =>
      current.map((record) =>
        record.id === latest.assignmentId
          ? { ...record, status: response === "accepted" ? "accepted" : response === "declined" ? "declined" : "acknowledged" }
          : record,
      ),
    );
    setWorkOrders((current) =>
      current.map((record) => {
        if (record.id !== workOrderId) return record;
        if (response === "declined") {
          return {
            ...record,
            fulfillmentMode: "unassigned",
            status: "draft",
            accountable: facilitiesOwner
              ? {
                  partyType: "person",
                  partyId: facilitiesOwner.id,
                  nextAction: "Choose another internal team or approved vendor",
                  dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
                  escalationPartyId: facilitiesOwner.id,
                }
              : record.accountable,
          };
        }
        return {
          ...record,
          status: response === "date_proposed" ? "scheduled" : "accepted",
          scheduledWindow:
            response === "date_proposed"
              ? { startsAt: proposedArrivalAt, endsAt: new Date(Date.parse(proposedArrivalAt) + 2 * 60 * 60 * 1000).toISOString() }
              : record.scheduledWindow,
          accountable: record.accountable
            ? {
                ...record.accountable,
                nextAction:
                  response === "date_proposed"
                    ? "Facilities manager reviews the proposed arrival window"
                    : "Vendor schedules service and records the onsite visit",
              }
            : record.accountable,
        };
      }),
    );
    appendAuditEvent("vendor_issuance", latest.id, `Vendor ${words(response)}`, {
      workOrderId,
      vendorId: latest.vendorId,
      response,
    }, "vendor_link", "vendor_contact");
    setNotice(
      response === "accepted"
        ? "Vendor accepted the customer work order and added its service-ticket reference."
        : response === "date_proposed"
          ? "Vendor proposed an arrival window; the facilities manager now owns the review."
          : "Vendor declined. The work remains visible and was returned for reassignment.",
    );
  }

  function recordVisitCheckIn(value: VisitCheckInValue): ActiveVisit | void {
    if (!guardPermission("recordVisits", "record vendor visits")) return;
    if (!dataset.stores.some((store) => store.id === value.storeId)) {
      setNotice("That store is outside this role’s assigned scope.");
      return;
    }
    const vendor = dataset.vendors.find((record) => record.displayName === value.vendorName);
    const id = `visit-session-${Date.now()}`;
    const evidence = domainVisitEvidence(value.evidence);
    const visit: Visit = {
      id,
      organizationId: dataset.organization.id,
      storeId: value.storeId,
      workOrderId: value.workOrderId,
      vendorId: vendor?.id,
      technicianName: value.technicianName,
      technicianIdentifier: `${vendor?.customerVendorNumber ?? "VENDOR"}-${value.technicianName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
      purposeWhenUnmatched: value.noWorkOrderReason,
      channelStarted: domainVisitChannel(value.channel),
      checkedInAt: value.recordedAt,
      ...evidence,
      documentIds: [],
    };
    setVisits((current) => [visit, ...current]);
    if (value.workOrderId) {
      setWorkOrders((current) =>
        current.map((record) =>
          record.id === value.workOrderId
            ? {
                ...record,
                status: "onsite",
                accountable: record.accountable
                  ? { ...record.accountable, nextAction: "Technician records an outcome before leaving the store" }
                  : record.accountable,
              }
            : record,
        ),
      );
    } else if (facilitiesOwner(dataset)) {
      const owner = facilitiesOwner(dataset)!;
      setExceptions((current) => [
        {
          id: `exception-session-${Date.now()}`,
          organizationId: dataset.organization.id,
          type: "visit_without_work_order",
          severity: "warning",
          status: "open",
          title: "Vendor visit has no customer work order",
          description: value.noWorkOrderReason ?? "The technician could not find a matching customer work order.",
          storeId: value.storeId,
          visitId: id,
          vendorId: vendor?.id,
          sourceRecordIds: [id],
          assignedPersonId: owner.id,
          openedAt: value.recordedAt,
          dueAt: new Date(Date.parse(value.recordedAt) + 24 * 60 * 60 * 1000).toISOString(),
        },
        ...current,
      ]);
    }
    appendAuditEvent("visit", id, "Technician checked in", {
      visitId: id,
      workOrderId: value.workOrderId ?? null,
      storeId: value.storeId,
      evidenceState: value.evidence.state,
    }, value.channel === "store_kiosk" ? "kiosk" : value.channel === "app" ? "vendor_app" : "qr", "technician");
    return {
      id,
      storeId: value.storeId,
      technicianName: value.technicianName,
      vendorName: value.vendorName,
      workOrderId: value.workOrderId,
      noWorkOrderReason: value.noWorkOrderReason,
      channel: value.channel,
      evidence: value.evidence,
      startedAt: value.recordedAt,
    };
  }

  function recordVisitCheckOut(value: VisitCheckOutValue) {
    if (!guardPermission("recordVisits", "record vendor visits")) return;
    const activeVisit = dataset.visits.find((record) => record.id === value.visitId);
    if (!activeVisit) return;
    const outcome = domainVisitOutcome(value.outcome);
    const freshEvidence = { ...value.evidence, capturedAt: value.recordedAt };
    const checkoutEvidence = domainVisitEvidence(freshEvidence);
    setVisits((current) =>
      current.map((record) =>
        record.id === value.visitId
          ? {
              ...record,
              checkedOutAt: value.recordedAt,
              channelEnded: domainVisitChannel(value.channel),
              outcome,
              checkoutNote: value.notes,
              evidenceStrength:
                record.evidenceStrength === "location_verified" || checkoutEvidence.evidenceStrength === "location_verified"
                  ? "location_verified"
                  : checkoutEvidence.evidenceStrength,
              locationEvidence: checkoutEvidence.locationEvidence,
            }
          : record,
      ),
    );
    if (activeVisit.workOrderId) {
      const followUpDue = new Date(Date.parse(value.recordedAt) + 3 * 24 * 60 * 60 * 1000).toISOString();
      setWorkOrders((current) =>
        current.map((record) => {
          if (record.id !== activeVisit.workOrderId) return record;
          const resolved = outcome === "resolved" || outcome === "preventive_complete";
          return {
            ...record,
            outcome,
            status: resolved ? "completed" : outcome === "diagnosed_waiting_parts" ? "waiting_parts" : "unresolved",
            completedAt: resolved ? value.recordedAt : undefined,
            accountable: record.accountable
              ? {
                  ...record.accountable,
                  nextAction: resolved
                    ? "Store or facilities manager verifies the result and closes the work order"
                    : outcome === "diagnosed_waiting_parts"
                      ? "Vendor confirms parts availability and proposed return date"
                      : "Facilities manager assigns the next diagnostic or return-visit action",
                  dueAt: followUpDue,
                }
              : record.accountable,
          };
        }),
      );
    }
    appendAuditEvent("visit", value.visitId, `Technician checked out · ${words(outcome)}`, {
      visitId: value.visitId,
      workOrderId: activeVisit.workOrderId ?? null,
      outcome,
      fileCount: value.files.length,
      evidenceState: value.evidence.state,
    }, value.channel === "store_kiosk" ? "kiosk" : value.channel === "app" ? "vendor_app" : "qr", "technician");
    setNotice("Visit checkout saved. The work order and next accountable action were updated.");
  }

  const rendered = detail ? (
    <DetailView
      dataset={dataset}
      detail={detail}
      onBack={() => setDetail(null)}
      onVendorRespond={respondToVendorWork}
      onIssue={openAuthorizationForWork}
      onOpenWork={(id) => setDetail({ kind: "work", id })}
      onOpenAsset={(id) => setDetail({ kind: "asset", id })}
      onClassify={(id) => { setClassificationWorkId(id); setDrawer("classify-work"); }}
      canClassify={hasPermission("classifyWork")}
      canIssueVendorWork={hasPermission("issueVendorWork")}
      canSimulateVendorResponse={hasPermission("simulateVendorResponse")}
    />
  ) : view === "today" ? (
    <TodayView
      dataset={dataset}
      activeVisits={activeVisits}
      openWork={openWork}
      exceptions={openExceptions}
      invoicedSpend={invoicedSpend}
      onNavigate={navigate}
      onOpen={setDetail}
      onCreate={() => openWorkOrderDrawer()}
      onStorePortal={() => { if (guardPermission("recordVisits", "open the store portal")) setDrawer("store-portal"); }}
      onVisit={() => { if (!guardPermission("recordVisits", "record vendor visits")) return; setVisitStoreId(null); setDrawer("visit"); }}
      scopeLabel={scopeLabel}
      roleLabel={rolePolicy.label}
      canCreateWork={hasPermission("createWork")}
      canUseStorePortal={hasPermission("recordVisits")}
      canRecordVisits={hasPermission("recordVisits")}
    />
  ) : view === "stores" ? (
    <StoresView dataset={dataset} onOpen={(id) => setDetail({ kind: "store", id })} onCreate={() => openWorkOrderDrawer()} onNewStore={() => setDrawer("new-store")} canCreateWork={hasPermission("createWork")} canCreateStore={hasPermission("createStore")} />
  ) : view === "work" ? (
    <WorkView dataset={dataset} onOpen={(id) => setDetail({ kind: "work", id })} onCreate={() => openWorkOrderDrawer()} canCreateWork={hasPermission("createWork")} />
  ) : view === "vendors" ? (
    <VendorsView dataset={dataset} onOpen={(id) => setDetail({ kind: "vendor", id })} />
  ) : view === "spend" ? (
    <SpendView
      dataset={dataset}
      onOpenWork={(id) => setDetail({ kind: "work", id })}
      onOpenStore={(id) => setDetail({ kind: "store", id })}
      onOpenAsset={(id) => setDetail({ kind: "asset", id })}
      onNavigate={navigate}
    />
  ) : view === "equipment" ? (
    <EquipmentView
      dataset={dataset}
      onOpenWork={(id) => setDetail({ kind: "work", id })}
      onOpenAsset={(id) => setDetail({ kind: "asset", id })}
    />
  ) : view === "pm" ? (
    <PmView dataset={dataset} onOpenWork={(id) => setDetail({ kind: "work", id })} />
  ) : (
    <ReportsView dataset={dataset} savedReports={savedReports} onSave={(title) => setSavedReports((current) => [title, ...current])} canGenerate={hasPermission("generateReports")} scopeLabel={scopeLabel} />
  );

  const drawerTitle =
    drawer === "create-work"
      ? "Create work order"
      : drawer === "issue-vendor"
        ? "Issue to outside vendor"
        : drawer === "store-portal"
          ? "Store portal"
          : drawer === "capabilities"
            ? "Suite settings"
            : drawer === "new-store"
              ? "Create a store"
              : drawer === "classify-work"
                ? "Update equipment classification"
                : "Vendor check-in";
  const drawerSubtitle =
    drawer === "create-work"
      ? "Start simple. Equipment and financial controls can be added later."
      : drawer === "issue-vendor"
        ? "This customer work order becomes the vendor’s authorization and invoice reference."
        : drawer === "capabilities"
          ? "Use only the controls that create value for this operator."
          : drawer === "new-store"
            ? "Create the location first, then add service structure only where it helps."
            : drawer === "classify-work"
              ? "Move from store-level work to category, system, asset, or component at any time."
              : "Focused store experience · Demo mode";

  return (
    <div className="to-app">
      <aside className="to-sidebar">
        <div className="to-brand">
          <div className="to-brand-mark">T</div>
          <div><strong>TraceOps</strong><span>Convenience Suite</span></div>
        </div>
        <div className="to-org-switcher"><small>Demo organization</small><strong>{dataset.organization.displayName}</strong></div>
        <p className="to-nav-label">Operate</p>
        <nav className="to-nav" aria-label="Main navigation">
          {roleNavItems.filter((item) => ["today", "stores", "work", "vendors"].includes(item.view)).map((item) => <NavButton key={item.view} item={item} active={view === item.view && !detail} onClick={() => navigate(item.view)} />)}
        </nav>
        <p className="to-nav-label">Understand</p>
        <nav className="to-nav" aria-label="Intelligence navigation">
          {intelligenceNavItems.map((item) => <NavButton key={item.view} item={item} active={view === item.view && !detail} onClick={() => navigate(item.view)} />)}
        </nav>
        {hasPermission("manageSuite") ? <><p className="to-nav-label">Configure</p><nav className="to-nav"><button type="button" onClick={() => setDrawer("capabilities")}><Settings2 /> Suite settings</button></nav></> : null}
        <div className="to-sidebar-foot"><span className="to-demo-pill">Demo mode</span><br />{scopeLabel}<br />{dataset.vendors.length} approved vendors · source-linked financials.</div>
      </aside>

      <main className="to-main">
        <header className="to-topbar">
          <div className="to-global-search">
            <Search />
            <input aria-label="Search the suite" value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="Search store number, address, vendor, work order…" />
            <span className="to-search-key">⌘ K</span>
            {searchResults.length ? (
              <div className="to-search-results">
                {searchResults.map((result) => (
                  <button key={`${result.kind}-${result.id}`} type="button" onClick={() => openResult(result)}>
                    <span><strong>{result.title}</strong><small>{result.meta}</small></span><ChevronRight />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="to-top-actions">
            <button className="to-icon-button" type="button" aria-label="Notifications" onClick={() => setNotice(`${openExceptions.length} open exceptions are included in the Today queue.`)}><Bell /></button>
            <select className="to-role" value={roleId} onChange={(event) => changeRole(event.target.value as DemoRoleId)} aria-label="Demo role">
              {demoRolePolicies.map((policy) => <option value={policy.id} key={policy.id}>{policy.label}</option>)}
            </select>
            <button className="to-icon-button" type="button" aria-label="User profile" onClick={() => setNotice(`Viewing Demo Mode as ${activePerson?.displayName ?? rolePolicy.label} · ${scopeLabel}.`)}><UserRound /></button>
          </div>
        </header>

        <div className="to-page">
          <div className="to-role-context" data-readonly={!Object.entries(rolePolicy.permissions).some(([key, allowed]) => key !== "generateReports" && allowed)}>
            <span className="to-avatar">{initials(activePerson?.displayName ?? rolePolicy.label)}</span>
            <span><small>Current demo perspective</small><strong>{activePerson?.displayName ?? rolePolicy.label} · {rolePolicy.label}</strong></span>
            <span className="to-role-scope"><strong>{scopeLabel}</strong><small>{rolePolicy.accessSummary}</small></span>
          </div>
          {notice ? <div className="to-notice"><CheckCircle2 /><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X /></button></div> : null}
          {rendered}
        </div>
      </main>

      <nav className="to-mobile-nav" aria-label="Mobile navigation">
        {mobileNavItems.map((item) => <NavButton key={item.view} item={item} active={view === item.view && !detail} onClick={() => navigate(item.view)} />)}
      </nav>

      {drawer ? (
        <DrawerShell title={drawerTitle} subtitle={drawerSubtitle} onClose={() => { setDrawer(null); setPendingAuthorization(null); setClassificationWorkId(null); setWorkInitialStoreId(null); }}>
          {drawer === "create-work" ? (
            <WorkOrderCreation
              stores={storeOptions}
              vendors={vendorOptions}
              internalTeams={dataset.teams.map((team) => ({ id: team.id, name: team.name, description: team.description, coverageLabel: "Internal regional coverage" }))}
              onCreate={createWorkOrder}
              initialValue={workInitialStoreId ? { storeId: workInitialStoreId } : undefined}
            />
          ) : drawer === "issue-vendor" && pendingAuthorization ? (
            <VendorServiceAuthorization authorization={pendingAuthorization} onIssue={issueAuthorization} onSaveDraft={(draft) => { setWorkOrders((current) => current.map((work) => work.id === draft.workOrderId ? { ...work, notToExceedMinor: draft.nteMinorUnits } : work)); setDraftAcceptanceByWork((current) => ({ ...current, [draft.workOrderId]: draft.acceptanceRequested })); setDrawer(null); setNotice(`${pendingAuthorization.customerWorkOrderNumber} authorization settings saved without sending. Reopen it from the work-order record.`); }} defaultAcceptanceRequested={draftAcceptanceByWork[pendingAuthorization.workOrderId] ?? capabilities.vendorAcceptance} />
          ) : drawer === "store-portal" ? (
            <StorePortal dataset={dataset} onWork={() => openWorkOrderDrawer(dataset.stores[0]?.id)} onVisit={(storeId) => { setVisitStoreId(storeId); setDrawer("visit"); }} onOpenIssues={() => { setDrawer(null); navigate("work"); }} />
          ) : drawer === "capabilities" ? (
            <CapabilitySettings value={capabilities} onChange={setCapabilities} />
          ) : drawer === "new-store" ? (
            <GuidedStoreSetup regions={dataset.regions} categories={dataset.categories} onCreate={createStore} />
          ) : drawer === "classify-work" && classificationWork && classificationStore ? (
            <WorkClassificationEditor
              workOrder={classificationWork}
              store={classificationStore}
              categories={dataset.categories}
              taxonomyNodes={dataset.taxonomyNodes}
              assets={dataset.assets}
              components={dataset.assetComponents}
              onSave={saveWorkClassification}
            />
          ) : (
            <VisitDemo dataset={dataset} activeVisits={activeVisits} fixedStoreId={visitStoreId ?? undefined} requireLocationEvidence={capabilities.locationEvidence} onCheckIn={recordVisitCheckIn} onCheckOut={recordVisitCheckOut} />
          )}
        </DrawerShell>
      ) : null}
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: { view: View; label: string; icon: typeof LayoutDashboard }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button type="button" data-active={active} onClick={onClick}><Icon />{item.label}</button>;
}

function DrawerShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [onClose]);
  return <div className="to-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside ref={dialogRef} tabIndex={-1} className="to-drawer" role="dialog" aria-modal="true" aria-label={title}><header className="to-drawer-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="to-close" type="button" onClick={onClose} aria-label="Close"><X /></button></header><div className="to-drawer-body">{children}</div></aside></div>;
}

function TodayView({ dataset, activeVisits, openWork, exceptions, invoicedSpend, onNavigate, onOpen, onCreate, onStorePortal, onVisit, scopeLabel, roleLabel, canCreateWork, canUseStorePortal, canRecordVisits }: { dataset: DemoDataset; activeVisits: Visit[]; openWork: WorkOrder[]; exceptions: ExceptionRecord[]; invoicedSpend: number; onNavigate: (view: View) => void; onOpen: (detail: Detail) => void; onCreate: () => void; onStorePortal: () => void; onVisit: () => void; scopeLabel: string; roleLabel: string; canCreateWork: boolean; canUseStorePortal: boolean; canRecordVisits: boolean }) {
  const critical = openWork.filter((work) => work.priority === "emergency" || work.priority === "urgent");
  const invoiceExceptions = exceptions.filter((record) => record.invoiceId);
  const heading = roleLabel === "Store manager"
    ? `${scopeLabel.split(" · ")[0]} needs attention today.`
    : roleLabel === "Regional manager"
      ? `${scopeLabel.split(" · ")[0]} needs attention today.`
      : roleLabel === "Owner / executive"
        ? "Portfolio signals worth your attention."
        : "Here’s what needs attention today.";
  return <>
    <PageHead eyebrow={`Monday, August 10 · ${scopeLabel}`} title={heading} description="Every signal below is limited to this role’s assigned scope and connects to its work, evidence, cost, and store source records.">
      {canUseStorePortal ? <button className="to-button" type="button" onClick={onStorePortal}><StoreIcon /> Store portal</button> : null}
      {canRecordVisits ? <button className="to-button" type="button" onClick={onVisit}><MapPin /> Vendor check-in</button> : null}
      {canCreateWork ? <button className="to-button primary" type="button" onClick={onCreate}><Plus /> New work order</button> : null}
    </PageHead>
    <section className="to-kpi-grid">
      <button className="to-kpi" type="button" onClick={() => onNavigate("work")}><div className="to-kpi-top"><span>Active vendor visits</span><span className="to-kpi-icon"><MapPin /></span></div><strong>{activeVisits.length}</strong><span>Across {new Set(activeVisits.map((visit) => visit.storeId)).size} stores right now</span></button>
      <button className="to-kpi" data-tone="coral" type="button" onClick={() => onNavigate("work")}><div className="to-kpi-top"><span>Critical and urgent</span><span className="to-kpi-icon"><AlertTriangle /></span></div><strong>{critical.length}</strong><span>{critical.filter((work) => work.status === "unresolved").length} unresolved after a visit</span></button>
      <button className="to-kpi" data-tone="blue" type="button" onClick={() => onNavigate("spend")}><div className="to-kpi-top"><span>Linked maintenance spend</span><span className="to-kpi-icon"><CircleDollarSign /></span></div><strong>{money(invoicedSpend)}</strong><span>Invoice-linked source records · trailing 12 months</span></button>
      <button className="to-kpi" data-tone="amber" type="button" onClick={() => onNavigate("spend")}><div className="to-kpi-top"><span>Invoice review</span><span className="to-kpi-icon"><ReceiptText /></span></div><strong>{invoiceExceptions.length}</strong><span>Missing WO, NTE, or evidence exceptions</span></button>
    </section>
    <section className="to-grid two">
      <article className="to-panel"><header className="to-panel-head"><div><h2>Priority exceptions</h2><p>Manage the exceptions, not every routine job.</p></div><button className="to-link-button" type="button" onClick={() => onNavigate("work")}>View all <ArrowRight /></button></header><div className="to-exception-list">{exceptions.slice(0, 6).map((exception) => <button className="to-exception" type="button" key={exception.id} onClick={() => exception.workOrderId ? onOpen({ kind: "work", id: exception.workOrderId }) : exception.storeId ? onOpen({ kind: "store", id: exception.storeId }) : undefined}><span className="to-exception-icon" data-tone={exception.severity === "critical" ? "red" : exception.invoiceId ? "blue" : undefined}>{exception.invoiceId ? <ReceiptText /> : exception.type === "visit_without_work_order" ? <MapPin /> : <AlertTriangle />}</span><span className="to-record-primary"><strong>{exception.title}</strong><span>{exception.description}</span></span><span className="to-record-meta">{exception.storeId ? `Store ${dataset.stores.find((store) => store.id === exception.storeId)?.storeNumber}` : "Portfolio"}<br />Due {dateLabel(exception.dueAt)}</span><Badge value={exception.severity} /></button>)}</div></article>
      <article className="to-panel"><header className="to-panel-head"><div><h2>Onsite now</h2><p>One visit record across QR, link, kiosk, and app.</p></div>{canRecordVisits ? <button className="to-link-button" type="button" onClick={onVisit}>Check in <ArrowRight /></button> : null}</header><div className="to-panel-body"><div className="to-visit-list">{activeVisits.length ? activeVisits.map((visit) => { const store = dataset.stores.find((record) => record.id === visit.storeId); const vendor = dataset.vendors.find((record) => record.id === visit.vendorId); return <div className="to-visit" key={visit.id}><span className="to-avatar">{initials(visit.technicianName)}</span><span><strong>{visit.technicianName}</strong><span>{vendor?.displayName ?? "Internal maintenance"} · Store {store?.storeNumber}</span></span><time>{timeLabel(visit.checkedInAt)}</time></div>; }) : <div className="to-empty"><MapPin /><strong>No technicians onsite</strong><p>New check-ins will appear here immediately.</p></div>}</div></div></article>
    </section>
    <section className="to-grid two"><SpendSnapshot dataset={dataset} onNavigate={onNavigate} /><StoreOutliers dataset={dataset} onOpen={(id) => onOpen({ kind: "store", id })} /></section>
  </>;
}

function SpendSnapshot({ dataset, onNavigate }: { dataset: DemoDataset; onNavigate: (view: View) => void }) {
  const rows = dataset.categories.map((category) => ({ category, spend: categorySpend(dataset, category.id) })).filter((row) => row.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 5);
  const total = rows.reduce((sum, row) => sum + row.spend, 0);
  return <article className="to-panel"><header className="to-panel-head"><div><h2>Where the money went</h2><p>Invoice-linked spend · trailing 12 months</p></div><button className="to-link-button" type="button" onClick={() => onNavigate("spend")}>Explore spend <ArrowRight /></button></header><div className="to-chart"><div className="to-donut"><div className="to-donut-center"><strong>{money(total)}</strong><span>selected spend</span></div></div><div className="to-legend">{rows.map((row, index) => <button type="button" onClick={() => onNavigate("spend")} key={row.category.id}><i style={{ background: ["#0b7568", "#df6d50", "#376f9e", "#d59a47", "#9eaaa6"][index] }} /><strong>{row.category.label}</strong><span>{total ? Math.round((row.spend / total) * 100) : 0}%</span><em>{money(row.spend)}</em></button>)}</div></div></article>;
}

function StoreOutliers({ dataset, onOpen }: { dataset: DemoDataset; onOpen: (id: string) => void }) {
  const rows = dataset.stores.map((store) => ({ store, spend: storeSpend(dataset, store.id), open: workForStore(dataset, store.id).filter((work) => !terminalStatuses.has(work.status)).length })).sort((a, b) => b.spend - a.spend).slice(0, 5);
  const max = rows[0]?.spend || 1;
  return <article className="to-panel"><header className="to-panel-head"><div><h2>Highest-cost stores</h2><p>Click a store to see the exact drivers.</p></div></header><div className="to-panel-body"><div className="to-bar-list">{rows.map((row) => <button className="to-bar-row to-link-row" type="button" key={row.store.id} onClick={() => onOpen(row.store.id)}><span className="to-bar-label"><strong>Store {row.store.storeNumber}</strong><span>{row.open} open work orders</span></span><span className="to-bar-track"><i style={{ width: `${Math.max(8, (row.spend / max) * 100)}%` }} /></span><b>{money(row.spend)}</b></button>)}</div></div></article>;
}

function StoresView({ dataset, onOpen, onCreate, onNewStore, canCreateWork, canCreateStore }: { dataset: DemoDataset; onOpen: (id: string) => void; onCreate: () => void; onNewStore: () => void; canCreateWork: boolean; canCreateStore: boolean }) {
  const [query, setQuery] = useState(""); const [regionId, setRegionId] = useState("all");
  const rows = dataset.stores.filter((store) => (regionId === "all" || store.regionId === regionId) && [store.storeNumber, store.name, store.normalizedAddress, ...store.searchTerms].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <><PageHead eyebrow={`${dataset.stores.length} active ${dataset.stores.length === 1 ? "store" : "stores"}`} title={dataset.stores.length === 1 ? "Your assigned store and its connected history." : "Find a store and understand it fast."} description="Search by store number, name, address, city, or legacy identifier. Results are limited to the current role’s scope.">{canCreateStore ? <button className="to-button" type="button" onClick={onNewStore}><Building2 /> New store</button> : null}{canCreateWork ? <button className="to-button primary" type="button" onClick={onCreate}><Plus /> New work order</button> : null}</PageHead><div className="to-toolbar"><div className="to-field grow"><label htmlFor="store-search">Search stores</label><input id="store-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try 104, West Broad, or Columbus…" /></div>{dataset.regions.length > 1 ? <div className="to-field"><label htmlFor="region-filter">Region</label><select id="region-filter" value={regionId} onChange={(event) => setRegionId(event.target.value)}><option value="all">All regions</option>{dataset.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div> : null}<span className="to-filter-count">{rows.length} {rows.length === 1 ? "store" : "stores"}</span></div><div className="to-store-grid">{rows.map((store) => { const open = workForStore(dataset, store.id).filter((work) => !terminalStatuses.has(work.status)); const spend = storeSpend(dataset, store.id); const exceptions = dataset.exceptions.filter((record) => record.storeId === store.id && record.status !== "resolved"); return <button className="to-card" type="button" key={store.id} onClick={() => onOpen(store.id)}><header className="to-card-head"><div><h3>Store {store.storeNumber}</h3><p>{store.name}<br />{store.address.line1}, {store.address.city}, {store.address.state}</p></div>{exceptions.some((record) => record.severity === "critical") ? <Badge value="critical" /> : <Badge value="open" label="Operating" />}</header><div className="to-card-body"><div className="to-tags"><span className="to-tag">{words(store.format)}</span><span className="to-tag">{store.open24Hours ? "Open 24 hours" : "Extended hours"}</span></div></div><footer className="to-card-facts"><div><span>Open work</span><strong>{open.length}</strong></div><div><span>Linked spend</span><strong>{money(spend)}</strong></div><div><span>Exceptions</span><strong>{exceptions.length}</strong></div></footer></button>; })}</div></>;
}

function WorkView({ dataset, onOpen, onCreate, canCreateWork }: { dataset: DemoDataset; onOpen: (id: string) => void; onCreate: () => void; canCreateWork: boolean }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("open");
  const rows = dataset.workOrders.filter((work) => (status === "all" || (status === "open" ? !terminalStatuses.has(work.status) : work.status === status)) && [work.number, work.title, work.problemDescription].join(" ").toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <><PageHead eyebrow="Customer work orders" title="One record from authorization to invoice." description="Internal and outside work stays connected. Every result below is limited to the current role’s assigned stores.">{canCreateWork ? <button className="to-button primary" type="button" onClick={onCreate}><Plus /> Create work order</button> : null}</PageHead><div className="to-toolbar"><div className="to-field grow"><label htmlFor="work-search">Search work</label><input id="work-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Work-order number, store, or problem…" /></div><div className="to-field"><label htmlFor="work-status">Status</label><select id="work-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">All active</option><option value="awaiting_vendor_response">Awaiting vendor</option><option value="onsite">Onsite</option><option value="waiting_parts">Waiting on parts</option><option value="completed">Completed</option><option value="all">Everything</option></select></div><span className="to-filter-count">{rows.length} work orders</span></div><article className="to-panel to-table-wrap"><table className="to-table"><thead><tr><th>Work order</th><th>Store</th><th>Who handles it</th><th>Status</th><th>Next action</th><th>Cost</th></tr></thead><tbody>{rows.map((work) => { const store = dataset.stores.find((record) => record.id === work.storeId); const assignment = dataset.assignments.find((record) => record.workOrderId === work.id); const vendor = assignment?.partyType === "vendor" ? dataset.vendors.find((record) => record.id === assignment.partyId) : undefined; const team = assignment?.partyType === "team" ? dataset.teams.find((record) => record.id === assignment.partyId) : undefined; return <tr key={work.id} onClick={() => onOpen(work.id)}><td><strong>{work.number}</strong><small>{work.title}</small></td><td><strong>#{store?.storeNumber}</strong><small>{store?.address.city}</small></td><td>{vendor?.displayName ?? team?.name ?? (work.fulfillmentMode === "unassigned" ? "Choose later" : words(work.fulfillmentMode))}</td><td><Badge value={work.status} /></td><td>{work.accountable?.nextAction ?? "Review history"}<small>{work.accountable ? `Due ${dateLabel(work.accountable.dueAt)}` : ""}</small></td><td className="to-money">{money(workOrderCost(dataset, work.id))}</td></tr>; })}</tbody></table></article></>;
}

function VendorsView({ dataset, onOpen }: { dataset: DemoDataset; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const rows = dataset.vendors.filter((vendor) => [vendor.displayName, vendor.description, ...vendor.aliases, ...vendor.searchTerms, ...vendor.specialties.flatMap((specialty) => [specialty.label, ...specialty.aliases, ...specialty.equipmentTypes])].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <><PageHead eyebrow="Approved vendor network" title="Find the right vendor by name or what they do." description="Search plain-language needs such as plumber, beer cave, fuel pump, parking-lot lights, or snow removal. Results explain coverage and preference."></PageHead><div className="to-toolbar"><div className="to-field grow"><label htmlFor="vendor-search">Search vendors and specialties</label><input id="vendor-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try refrigeration, plumber, beer cave, or a company name…" /></div><span className="to-filter-count">{rows.length} approved vendors</span></div><div className="to-vendor-grid">{rows.map((vendor) => { const workIds = new Set(dataset.assignments.filter((assignment) => assignment.partyType === "vendor" && assignment.partyId === vendor.id).map((assignment) => assignment.workOrderId)); const active = dataset.workOrders.filter((work) => workIds.has(work.id) && !terminalStatuses.has(work.status)).length; const visits = dataset.visits.filter((visit) => visit.vendorId === vendor.id).length; return <button className="to-card" type="button" key={vendor.id} onClick={() => onOpen(vendor.id)}><header className="to-card-head"><div><h3>{vendor.displayName}</h3><p>{vendor.description}</p></div><Badge value={vendor.status} /></header><div className="to-card-body"><div className="to-tags">{vendor.specialties.slice(0, 4).map((specialty) => <span className="to-tag" key={specialty.label}>{specialty.label}</span>)}</div></div><footer className="to-card-facts"><div><span>Active work</span><strong>{active}</strong></div><div><span>Visits</span><strong>{visits}</strong></div><div><span>Linked spend</span><strong>{money(vendorSpend(dataset, vendor.id))}</strong></div></footer></button>; })}</div></>;
}

export function LegacySpendView({ dataset, onOpenWork, onNavigate }: { dataset: DemoDataset; onOpenWork: (id: string) => void; onNavigate: (view: View) => void }) {
  const total = dataset.invoiceWorkLinks.reduce((sum, link) => sum + link.attributedAmountMinor, 0); const invoiceReview = dataset.invoices.filter((invoice) => invoice.status === "needs_review"); const rows = dataset.categories.map((category) => ({ category, spend: categorySpend(dataset, category.id) })).filter((row) => row.spend).sort((a, b) => b.spend - a.spend); const max = rows[0]?.spend || 1;
  return <><PageHead eyebrow="Invoice-linked cost basis · trailing 12 months" title="Every maintenance dollar has a source story." description="Move from company totals to a store, category, asset, work order, visit, and invoice without changing the selected cost basis."><button className="to-button" type="button" onClick={() => onNavigate("reports")}><FileBarChart /> Generate report</button></PageHead><section className="to-kpi-grid"><div className="to-kpi"><div className="to-kpi-top"><span>Selected spend</span><span className="to-kpi-icon"><CircleDollarSign /></span></div><strong>{money(total)}</strong><span>{dataset.invoiceWorkLinks.length} linked cost allocations</span></div><div className="to-kpi" data-tone="coral"><div className="to-kpi-top"><span>Highest category</span><span className="to-kpi-icon"><Gauge /></span></div><strong>{rows[0]?.category.label}</strong><span>{money(rows[0]?.spend ?? 0)} from source invoices</span></div><div className="to-kpi" data-tone="amber"><div className="to-kpi-top"><span>Invoice exceptions</span><span className="to-kpi-icon"><ReceiptText /></span></div><strong>{invoiceReview.length}</strong><span>Human review required before AP handoff</span></div><div className="to-kpi" data-tone="blue"><div className="to-kpi-top"><span>Classified to asset</span><span className="to-kpi-icon"><PackageSearch /></span></div><strong>{Math.round((dataset.invoiceWorkLinks.filter((link) => link.assetId).length / Math.max(1, dataset.invoiceWorkLinks.length)) * 100)}%</strong><span>Unclassified work remains visible in totals</span></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Spend by service area</h2><p>Click through to supporting work.</p></div></header><div className="to-panel-body"><div className="to-bar-list">{rows.map((row) => <div className="to-bar-row" key={row.category.id}><span className="to-bar-label"><strong>{row.category.label}</strong><span>{Math.round((row.spend / total) * 100)}% of selected spend</span></span><span className="to-bar-track"><i style={{ width: `${(row.spend / max) * 100}%` }} /></span><b>{money(row.spend)}</b></div>)}</div></div></article><StoreOutliers dataset={dataset} onOpen={(storeId) => { const work = dataset.workOrders.find((record) => record.storeId === storeId); if (work) onOpenWork(work.id); }} /></section><article className="to-panel"><header className="to-panel-head"><div><h2>Invoices needing review</h2><p>Exceptions are facts to review—not automatic accusations.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Invoice</th><th>Vendor</th><th>Customer WO reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoiceReview.map((invoice) => { const vendor = dataset.vendors.find((record) => record.id === invoice.vendorId); const link = dataset.invoiceWorkLinks.find((record) => record.invoiceId === invoice.id); return <tr key={invoice.id} onClick={() => link ? onOpenWork(link.workOrderId) : undefined}><td><strong>{invoice.invoiceNumber}</strong><small>Received {dateLabel(invoice.receivedAt)}</small></td><td>{vendor?.displayName}</td><td>{invoice.customerWorkOrderReferences.join(", ") || "Missing"}</td><td className="to-money">{money(invoiceTotal(dataset, invoice.id))}</td><td><Badge value={invoice.status} /></td></tr>; })}</tbody></table></div></article></>;
}

function SpendView({ dataset, onOpenWork, onOpenStore, onOpenAsset, onNavigate }: { dataset: DemoDataset; onOpenWork: (id: string) => void; onOpenStore: (id: string) => void; onOpenAsset: (id: string) => void; onNavigate: (view: View) => void }) {
  const [regionId, setRegionId] = useState("all");
  const [storeId, setStoreId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const availableStores = dataset.stores.filter((store) => regionId === "all" || store.regionId === regionId);
  const scopedStoreIds = new Set(availableStores.filter((store) => storeId === "all" || store.id === storeId).map((store) => store.id));
  const links = dataset.invoiceWorkLinks.filter((link) => scopedStoreIds.has(link.storeId) && (categoryId === "all" || link.categoryId === categoryId));
  const total = links.reduce((sum, link) => sum + link.attributedAmountMinor, 0);
  const categoryRows = dataset.categories
    .map((category) => ({ category, links: links.filter((link) => link.categoryId === category.id) }))
    .map((row) => ({ ...row, spend: row.links.reduce((sum, link) => sum + link.attributedAmountMinor, 0) }))
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  const storeRows = dataset.stores
    .filter((store) => scopedStoreIds.has(store.id))
    .map((store) => ({ store, links: links.filter((link) => link.storeId === store.id) }))
    .map((row) => ({ ...row, spend: row.links.reduce((sum, link) => sum + link.attributedAmountMinor, 0) }))
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  const assetRows = dataset.assets
    .filter((asset) => scopedStoreIds.has(asset.storeId) && (categoryId === "all" || asset.categoryId === categoryId))
    .map((asset) => ({ asset, links: links.filter((link) => link.assetId === asset.id) }))
    .map((row) => ({ ...row, spend: row.links.reduce((sum, link) => sum + link.attributedAmountMinor, 0) }))
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  const assetClassified = links.filter((link) => link.assetId).reduce((sum, link) => sum + link.attributedAmountMinor, 0);
  const selectedRegion = dataset.regions.find((region) => region.id === regionId);
  const selectedStore = dataset.stores.find((store) => store.id === storeId);
  const selectedCategory = dataset.categories.find((category) => category.id === categoryId);
  const maxCategory = categoryRows[0]?.spend || 1;
  const maxStore = storeRows[0]?.spend || 1;

  return <><PageHead eyebrow="Invoice-linked cost basis · trailing 12 months" title="Move from the company total to the source record." description="Change operating scope and maintenance depth independently. Every amount below is calculated from the same invoice-to-work-order allocations."><button className="to-button" type="button" onClick={() => onNavigate("reports")}><FileBarChart /> Generate report</button></PageHead><div className="to-toolbar"><div className="to-field"><label htmlFor="spend-region">Region</label><select id="spend-region" value={regionId} onChange={(event) => { setRegionId(event.target.value); setStoreId("all"); }}><option value="all">All regions</option>{dataset.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div><div className="to-field"><label htmlFor="spend-store">Store</label><select id="spend-store" value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="all">All stores in scope</option>{availableStores.map((store) => <option key={store.id} value={store.id}>#{store.storeNumber} · {store.address.city}</option>)}</select></div><div className="to-field"><label htmlFor="spend-category">Service area</label><select id="spend-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">All service areas</option>{dataset.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></div><button className="to-button ghost" type="button" onClick={() => { setRegionId("all"); setStoreId("all"); setCategoryId("all"); }}>Reset scope</button></div><div className="to-scope-trail"><span>Company</span><ChevronRight />{selectedRegion ? <><span>{selectedRegion.name}</span><ChevronRight /></> : <span>All regions</span>}{selectedStore ? <><span>Store {selectedStore.storeNumber}</span><ChevronRight /></> : null}<strong>{selectedCategory?.label ?? "All service areas"}</strong></div><section className="to-kpi-grid"><div className="to-kpi"><div className="to-kpi-top"><span>Selected spend</span><span className="to-kpi-icon"><CircleDollarSign /></span></div><strong>{money(total)}</strong><span>{links.length} source-linked allocations · invoice basis</span></div><button className="to-kpi" data-tone="coral" type="button" onClick={() => storeRows[0] && onOpenStore(storeRows[0].store.id)}><div className="to-kpi-top"><span>Highest-cost store</span><span className="to-kpi-icon"><StoreIcon /></span></div><strong>{storeRows[0] ? `#${storeRows[0].store.storeNumber}` : "—"}</strong><span>{money(storeRows[0]?.spend ?? 0)} · click for store record</span></button><button className="to-kpi" data-tone="amber" type="button" onClick={() => assetRows[0] && onOpenAsset(assetRows[0].asset.id)}><div className="to-kpi-top"><span>Highest-cost asset</span><span className="to-kpi-icon"><Gauge /></span></div><strong>{assetRows[0]?.asset.assetCode ?? "Unclassified"}</strong><span>{money(assetRows[0]?.spend ?? 0)} · click for lifecycle history</span></button><div className="to-kpi" data-tone="blue"><div className="to-kpi-top"><span>Mapped to an asset</span><span className="to-kpi-icon"><PackageSearch /></span></div><strong>{total ? Math.round((assetClassified / total) * 100) : 0}%</strong><span>Unclassified spend stays in the selected total</span></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Service-area drilldown</h2><p>Choose a category without changing operating scope.</p></div></header><div className="to-panel-body"><div className="to-bar-list">{categoryRows.map((row) => <button className="to-bar-row to-link-row" type="button" key={row.category.id} onClick={() => setCategoryId(row.category.id)}><span className="to-bar-label"><strong>{row.category.label}</strong><span>{row.links.length} source allocations</span></span><span className="to-bar-track"><i style={{ width: `${Math.max(4, (row.spend / maxCategory) * 100)}%`, background: row.category.color }} /></span><b>{money(row.spend)}</b></button>)}</div></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Store drilldown</h2><p>Open a store to see work, visits, equipment, and PM.</p></div></header><div className="to-panel-body"><div className="to-bar-list">{storeRows.slice(0, 8).map((row) => <button className="to-bar-row to-link-row" type="button" key={row.store.id} onClick={() => onOpenStore(row.store.id)}><span className="to-bar-label"><strong>Store {row.store.storeNumber}</strong><span>{row.store.address.city} · {row.links.length} allocations</span></span><span className="to-bar-track"><i style={{ width: `${Math.max(4, (row.spend / maxStore) * 100)}%` }} /></span><b>{money(row.spend)}</b></button>)}</div></div></article></section>{assetRows.length ? <article className="to-panel to-spend-assets"><header className="to-panel-head"><div><h2>Equipment drivers</h2><p>{selectedCategory ? `${selectedCategory.label} · ` : ""}only classified spend appears here.</p></div><span className="to-filter-count">{assetRows.length} assets</span></header><div className="to-record-list">{assetRows.slice(0, 8).map((row) => { const store = dataset.stores.find((record) => record.id === row.asset.storeId); return <button className="to-record-row to-spend-asset-row" type="button" key={row.asset.id} onClick={() => onOpenAsset(row.asset.id)}><span className="to-exception-icon" data-tone="blue"><Gauge /></span><span className="to-record-primary"><strong>{row.asset.name}</strong><span>Store {store?.storeNumber} · {row.asset.assetCode} · {row.asset.manufacturer} {row.asset.model}</span></span><span className="to-record-meta">{row.links.length} allocations</span><strong className="to-money">{money(row.spend)}</strong><ChevronRight /></button>; })}</div></article> : null}<article className="to-panel"><header className="to-panel-head"><div><h2>Supporting source records</h2><p>Open the customer work order behind any selected amount.</p></div><span className="to-filter-count">{links.length} allocations</span></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Customer WO</th><th>Store</th><th>Service area</th><th>Vendor invoice</th><th>Match</th><th>Attributed amount</th></tr></thead><tbody>{links.slice(0, 18).map((link) => { const work = dataset.workOrders.find((record) => record.id === link.workOrderId); const store = dataset.stores.find((record) => record.id === link.storeId); const category = dataset.categories.find((record) => record.id === link.categoryId); const invoice = dataset.invoices.find((record) => record.id === link.invoiceId); return <tr key={link.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenWork(link.workOrderId)}><span><strong>{work?.number}</strong><small>{work?.title}</small></span><ChevronRight /></button></td><td>#{store?.storeNumber}<small>{store?.address.city}</small></td><td>{category?.label ?? "Unclassified"}</td><td>{invoice?.invoiceNumber}<small>{invoice?.customerWorkOrderReferences.join(", ") || "WO reference missing"}</small></td><td><Badge value={link.matchStatus} /></td><td className="to-money">{money(link.attributedAmountMinor)}</td></tr>; })}</tbody></table></div></article></>;
}

function EquipmentView({ dataset, onOpenWork, onOpenAsset }: { dataset: DemoDataset; onOpenWork: (id: string) => void; onOpenAsset: (id: string) => void }) {
  const assets = [...dataset.assets].sort((a, b) => { const aCost = dataset.invoiceWorkLinks.filter((link) => link.assetId === a.id).reduce((sum, link) => sum + link.attributedAmountMinor, 0); const bCost = dataset.invoiceWorkLinks.filter((link) => link.assetId === b.id).reduce((sum, link) => sum + link.attributedAmountMinor, 0); return bCost - aCost; });
  return <><PageHead eyebrow={`${dataset.assets.length} tracked assets`} title="Equipment history that earns its setup." description="Start with store and category. Add model, serial, warranty, components, and lifecycle depth only where it improves decisions."></PageHead><div className="to-asset-grid">{assets.slice(0, 18).map((asset) => { const store = dataset.stores.find((record) => record.id === asset.storeId); const cost = dataset.invoiceWorkLinks.filter((link) => link.assetId === asset.id).reduce((sum, link) => sum + link.attributedAmountMinor, 0); const work = dataset.workOrders.filter((record) => record.assetId === asset.id); const age = Math.max(0, new Date(dataset.asOf).getUTCFullYear() - Number(asset.installedOn.slice(0, 4))); const review = cost > asset.replacementEstimateMinor * .35 || age >= asset.expectedLifeYears; return <article className="to-card" key={asset.id}><header className="to-card-head"><div><h3>{asset.name}</h3><p>Store {store?.storeNumber} · {asset.locationDetail}<br />{asset.manufacturer} {asset.model}</p></div>{review ? <Badge value="warning" label="Capital review" /> : <Badge value={asset.status} />}</header><div className="to-card-body"><div className="to-tags"><span className="to-tag">{asset.assetType}</span><span className="to-tag">{age} years old</span>{asset.warranty ? <span className="to-tag">Warranty to {dateLabel(asset.warranty.endsOn)}</span> : null}</div></div><footer className="to-card-facts"><div><span>Linked spend</span><strong>{money(cost)}</strong></div><div><span>Work orders</span><strong>{work.length}</strong></div><div><span>Replace est.</span><strong>{money(asset.replacementEstimateMinor)}</strong></div></footer><div className="to-card-actions"><button className="to-card-action" type="button" onClick={() => onOpenAsset(asset.id)}>Open equipment record <ChevronRight /></button>{work[0] ? <button className="to-card-action secondary" type="button" onClick={() => onOpenWork(work[0].id)}>Latest work order <ArrowRight /></button> : null}</div></article>; })}</div></>;
}

function PmView({ dataset, onOpenWork }: { dataset: DemoDataset; onOpenWork: (id: string) => void }) {
  const completed = dataset.pmOccurrences.filter((record) => record.status === "completed").length; const denominator = dataset.pmOccurrences.filter((record) => record.status !== "upcoming").length; const compliance = denominator ? Math.round((completed / denominator) * 100) : 100; const open = dataset.pmOccurrences.filter((record) => record.status !== "completed");
  return <><PageHead eyebrow="Preventive maintenance" title="See what is due, missed, and actually completed." description="PM uses the same customer work order, vendor issuance, visit evidence, cost, and audit trail as reactive maintenance."></PageHead><section className="to-kpi-grid"><div className="to-kpi"><div className="to-kpi-top"><span>PM compliance</span><span className="to-kpi-icon"><CalendarCheck /></span></div><strong>{compliance}%</strong><span>{completed} completed of {denominator} due in the selected window</span></div><div className="to-kpi" data-tone="amber"><div className="to-kpi-top"><span>Due and upcoming</span><span className="to-kpi-icon"><Clock3 /></span></div><strong>{open.filter((record) => record.status === "due" || record.status === "upcoming").length}</strong><span>Across HVAC, refrigeration, and exterior service</span></div><div className="to-kpi" data-tone="coral"><div className="to-kpi-top"><span>Overdue</span><span className="to-kpi-icon"><AlertTriangle /></span></div><strong>{open.filter((record) => record.status === "overdue").length}</strong><span>Visible until resolved or waived with reason</span></div><div className="to-kpi" data-tone="blue"><div className="to-kpi-top"><span>Active plans</span><span className="to-kpi-icon"><ClipboardList /></span></div><strong>{dataset.pmPlans.filter((record) => record.active).length}</strong><span>Store, asset, and category schedules</span></div></section><article className="to-panel"><header className="to-panel-head"><div><h2>PM schedule</h2><p>Every row links to the occurrence and customer work order.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Plan</th><th>Store</th><th>Due</th><th>Assigned to</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{dataset.pmOccurrences.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((occurrence) => { const plan = dataset.pmPlans.find((record) => record.id === occurrence.pmPlanId); const store = dataset.stores.find((record) => record.id === occurrence.storeId); const vendor = plan?.assignedPartyType === "vendor" ? dataset.vendors.find((record) => record.id === plan.assignedPartyId) : undefined; const team = plan?.assignedPartyType === "team" ? dataset.teams.find((record) => record.id === plan.assignedPartyId) : undefined; return <tr key={occurrence.id} onClick={() => occurrence.workOrderId ? onOpenWork(occurrence.workOrderId) : undefined}><td><strong>{plan?.name}</strong><small>{plan?.cadence ? words(plan.cadence) : ""}</small></td><td>#{store?.storeNumber}<small>{store?.address.city}</small></td><td>{dateLabel(occurrence.dueAt)}</td><td>{vendor?.displayName ?? team?.name ?? "Unassigned"}</td><td><Badge value={occurrence.status} /></td><td>{plan?.requiredEvidence.map(words).join(" · ")}</td></tr>; })}</tbody></table></div></article></>;
}

function ReportsView({ dataset, savedReports, onSave, canGenerate, scopeLabel }: { dataset: DemoDataset; savedReports: string[]; onSave: (title: string) => void; canGenerate: boolean; scopeLabel: string }) {
  const templates = [{ title: "Monthly owner operating review", description: `Spend, critical work, vendor exceptions, PM, and capital review across ${dataset.stores.length} ${dataset.stores.length === 1 ? "store" : "stores"}.` }, { title: "Vendor accountability review", description: "Acceptance, observed visits, unresolved outcomes, return trips, and invoice evidence by provider." }, { title: "Refrigeration lifecycle review", description: "Store and asset outliers, repeat repairs, warranties, PM history, and source work orders." }];
  return <><PageHead eyebrow={`Management records · ${scopeLabel}`} title="Explore live. Generate when it needs to be handed off." description="Dashboards remain interactive; generated reports preserve the current role’s scope, period, cost basis, definitions, and source links."></PageHead><div className="to-store-grid">{templates.map((template) => <article className="to-card to-report-card" key={template.title}><header className="to-card-head"><div><h3>{template.title}</h3><p>{template.description}</p></div><FileText /></header><div className="to-card-body"><div className="to-tags"><span className="to-tag">{scopeLabel}</span><span className="to-tag">Invoice-linked</span><span className="to-tag">Source records included</span></div></div>{canGenerate ? <button className="to-card-action" type="button" onClick={() => onSave(`${template.title} · ${scopeLabel} · ${dateLabel(dataset.asOf)}`)}>Generate report <ArrowRight /></button> : null}</article>)}</div>{savedReports.length ? <article className="to-panel to-saved-reports"><header className="to-panel-head"><div><h2>Generated in this demo</h2><p>Each is a new immutable version.</p></div></header><div className="to-record-list">{savedReports.map((report, index) => <div className="to-record-row to-generated-report" key={`${report}-${index}`}><span className="to-exception-icon" data-tone="blue"><FileBarChart /></span><span className="to-record-primary"><strong>{report}</strong><span>{dataset.organization.displayName} · {scopeLabel} · invoice-linked basis</span></span><Badge value="completed" label="Version 1" /></div>)}</div></article> : null}</>;
}

function DetailView({ dataset, detail, onBack, onVendorRespond, onIssue, onOpenWork, onOpenAsset, onClassify, canClassify, canIssueVendorWork, canSimulateVendorResponse }: { dataset: DemoDataset; detail: NonNullable<Detail>; onBack: () => void; onVendorRespond: (workOrderId: string, response: "accepted" | "declined" | "date_proposed") => void; onIssue: (workOrderId: string) => void; onOpenWork: (workOrderId: string) => void; onOpenAsset: (assetId: string) => void; onClassify: (workOrderId: string) => void; canClassify: boolean; canIssueVendorWork: boolean; canSimulateVendorResponse: boolean }) {
  if (detail.kind === "store") { const store = dataset.stores.find((record) => record.id === detail.id); if (!store) return null; return <StoreDetail dataset={dataset} store={store} onBack={onBack} onOpenWork={onOpenWork} onOpenAsset={onOpenAsset} />; }
  if (detail.kind === "vendor") { const vendor = dataset.vendors.find((record) => record.id === detail.id); if (!vendor) return null; return <VendorDetail dataset={dataset} vendor={vendor} onBack={onBack} onOpenWork={onOpenWork} />; }
  if (detail.kind === "asset") { const asset = dataset.assets.find((record) => record.id === detail.id); if (!asset) return null; return <AssetDetail dataset={dataset} asset={asset} onBack={onBack} onOpenWork={onOpenWork} />; }
  const work = dataset.workOrders.find((record) => record.id === detail.id);
  if (!work) return null;
  return <>{canClassify ? <div className="to-detail-tools"><button className="to-button" type="button" onClick={() => onClassify(work.id)}><PackageSearch /> Update equipment classification</button></div> : null}<WorkDetail dataset={dataset} work={work} onBack={onBack} onVendorRespond={onVendorRespond} onIssue={onIssue} onOpenAsset={onOpenAsset} canIssueVendorWork={canIssueVendorWork} canSimulateVendorResponse={canSimulateVendorResponse} /></>;
}

function StoreDetail({ dataset, store, onBack, onOpenWork, onOpenAsset }: { dataset: DemoDataset; store: Store; onBack: () => void; onOpenWork: (id: string) => void; onOpenAsset: (id: string) => void }) {
  const work = workForStore(dataset, store.id); const open = work.filter((record) => !terminalStatuses.has(record.status)); const spend = storeSpend(dataset, store.id); const assets = dataset.assets.filter((asset) => asset.storeId === store.id); const visits = dataset.visits.filter((visit) => visit.storeId === store.id); const exceptions = dataset.exceptions.filter((record) => record.storeId === store.id && record.status !== "resolved");
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to all stores</button><p className="to-eyebrow">{dataset.regions.find((region) => region.id === store.regionId)?.name}</p><h1>Store {store.storeNumber} · {store.name}</h1><p>{store.address.line1}, {store.address.city}, {store.address.state} {store.address.postalCode} · {store.phone}</p></div><div className="to-detail-summary"><div><span>Linked spend</span><strong>{money(spend)}</strong></div><div><span>Open work</span><strong>{open.length}</strong></div><div><span>Tracked assets</span><strong>{assets.length}</strong></div><div><span>Exceptions</span><strong>{exceptions.length}</strong></div></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Store attention</h2><p>Current work and accountable next actions</p></div></header><div className="to-exception-list">{open.slice(0, 6).map((record) => <button className="to-exception" type="button" key={record.id} onClick={() => onOpenWork(record.id)}><span className="to-exception-icon"><Wrench /></span><span className="to-record-primary"><strong>{record.number} · {record.title}</strong><span>{record.accountable?.nextAction}</span></span><span className="to-record-meta">{dateLabel(record.accountable?.dueAt)}</span><Badge value={record.status} /></button>)}</div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Visit history</h2><p>{visits.length} observed visits at this store</p></div></header><div className="to-panel-body"><div className="to-visit-list">{visits.slice(0, 6).map((visit) => { const vendor = dataset.vendors.find((record) => record.id === visit.vendorId); return <div className="to-visit" key={visit.id}><span className="to-avatar">{initials(visit.technicianName)}</span><span><strong>{visit.technicianName}</strong><span>{vendor?.displayName ?? "Internal"} · {visit.outcome ? words(visit.outcome) : "Active now"}</span></span><time>{dateLabel(visit.checkedInAt)}</time></div>; })}</div></div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Equipment and service structure</h2><p>Progressive depth—only the known assets are tracked.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Asset</th><th>Category</th><th>Location</th><th>Model / serial</th><th>Warranty</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenAsset(asset.id)}><span><strong>{asset.assetCode}</strong><small>{asset.name}</small></span><ChevronRight /></button></td><td>{dataset.categories.find((category) => category.id === asset.categoryId)?.label}</td><td>{asset.locationDetail}</td><td>{asset.manufacturer} {asset.model}<small>{asset.serialNumber}</small></td><td>{asset.warranty ? dateLabel(asset.warranty.endsOn) : "Not recorded"}</td></tr>)}</tbody></table></div></article></>;
}

function AssetDetail({ dataset, asset, onBack, onOpenWork }: { dataset: DemoDataset; asset: Asset; onBack: () => void; onOpenWork: (id: string) => void }) {
  const store = dataset.stores.find((record) => record.id === asset.storeId);
  const category = dataset.categories.find((record) => record.id === asset.categoryId);
  const taxonomyPath = asset.taxonomyPathIds
    .map((id) => dataset.taxonomyNodes.find((record) => record.id === id)?.label)
    .filter(Boolean)
    .join(" → ");
  const components = dataset.assetComponents.filter((record) => record.assetId === asset.id);
  const work = dataset.workOrders
    .filter((record) => record.assetId === asset.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const workIds = new Set(work.map((record) => record.id));
  const visits = dataset.visits.filter((record) => record.workOrderId && workIds.has(record.workOrderId));
  const pmPlans = dataset.pmPlans.filter((record) => record.assetId === asset.id);
  const candidate = findLifecycleCandidates(dataset, dataset.organization.id, { assetId: asset.id })[0];
  const spend = dataset.invoiceWorkLinks
    .filter((record) => record.assetId === asset.id)
    .reduce((sum, record) => sum + record.attributedAmountMinor, 0);
  const age = Math.round(((Date.parse(dataset.asOf) - Date.parse(asset.installedOn)) / (365.25 * 86400000)) * 10) / 10;
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to equipment</button><p className="to-eyebrow">Store {store?.storeNumber} · {category?.label}</p><h1>{asset.name}</h1><p>{asset.assetCode} · {taxonomyPath} · {asset.locationDetail}</p></div><div className="to-detail-summary"><div><span>Linked repair spend</span><strong>{money(spend)}</strong></div><div><span>Replacement estimate</span><strong>{money(asset.replacementEstimateMinor)}</strong></div><div><span>Age</span><strong>{age} years</strong></div><div><span>Observed visits</span><strong>{visits.length}</strong></div></div></section><section className="to-grid two"><article className="to-panel"><header className="to-panel-head"><div><h2>Equipment record</h2><p>Identity, location, supplier, and warranty context</p></div><Badge value={asset.status} /></header><div className="to-panel-body"><dl className="to-mini-dl"><div><dt>Manufacturer / model</dt><dd>{asset.manufacturer} {asset.model}</dd></div><div><dt>Serial number</dt><dd>{asset.serialNumber}</dd></div><div><dt>Installed</dt><dd>{dateLabel(asset.installedOn)} · expected life {asset.expectedLifeYears} years</dd></div><div><dt>Criticality</dt><dd>{words(asset.criticality)}</dd></div><div><dt>Warranty</dt><dd>{asset.warranty ? `${asset.warranty.provider} through ${dateLabel(asset.warranty.endsOn)} · ${asset.warranty.coverage}` : "No warranty recorded"}</dd></div></dl></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Lifecycle review</h2><p>Transparent rules, not an opaque health score</p></div>{candidate ? <Badge value="warning" label="Capital review" /> : <Badge value="active" label="Monitor" />}</header><div className="to-panel-body">{candidate ? <><div className="to-lifecycle-metric"><strong>{candidate.repairToReplacementPercentage}%</strong><span>documented repair spend versus replacement estimate</span></div><ul className="to-reason-list">{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><details className="to-method"><summary>Why this record qualifies</summary><ul>{candidate.thresholds.map((threshold) => <li key={threshold}>{threshold}</li>)}</ul></details><p className="to-callout"><ShieldCheck /> Capital review is recommended. TraceOps does not automatically claim this asset must be replaced.</p></> : <div className="to-empty"><ShieldCheck /><strong>No capital-review rule is triggered</strong><p>Cost, repeat work, and service-life thresholds remain visible and source-linked.</p></div>}</div></article></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Components</h2><p>Optional depth for serviceable parts</p></div><span className="to-filter-count">{components.length} tracked</span></header><div className="to-record-list">{components.map((component) => <div className="to-record-row to-component-row" key={component.id}><span className="to-exception-icon" data-tone="blue"><PackageSearch /></span><span className="to-record-primary"><strong>{component.name}</strong><span>{component.componentCode} · {component.componentType}{component.manufacturer ? ` · ${component.manufacturer}` : ""}</span></span><Badge value={component.status} /></div>)}</div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Preventive maintenance</h2><p>The same work, visit, and evidence chain</p></div></header><div className="to-panel-body">{pmPlans.length ? pmPlans.map((plan) => <dl className="to-mini-dl" key={plan.id}><div><dt>Plan</dt><dd>{plan.name}</dd></div><div><dt>Cadence</dt><dd>{words(plan.cadence)}</dd></div><div><dt>Next due</dt><dd>{dateLabel(plan.nextDueAt)}</dd></div><div><dt>Evidence</dt><dd>{plan.requiredEvidence.map(words).join(" · ")}</dd></div></dl>) : <div className="to-empty"><CalendarCheck /><strong>No asset-specific PM plan</strong><p>Category or store-level PM may still cover this equipment.</p></div>}</div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Service history</h2><p>Open any customer work order to see visits, invoice references, and audit events.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Customer WO</th><th>Date</th><th>Problem</th><th>Status</th><th>Visits</th><th>Linked cost</th></tr></thead><tbody>{work.map((record) => <tr key={record.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenWork(record.id)}><strong>{record.number}</strong><ChevronRight /></button></td><td>{dateLabel(record.createdAt)}</td><td>{record.title}</td><td><Badge value={record.status} /></td><td>{dataset.visits.filter((visit) => visit.workOrderId === record.id).length}</td><td className="to-money">{money(workOrderCost(dataset, record.id))}</td></tr>)}</tbody></table></div></article></>;
}

function WorkDetail({ dataset, work, onBack, onVendorRespond, onIssue, onOpenAsset, canIssueVendorWork, canSimulateVendorResponse }: { dataset: DemoDataset; work: WorkOrder; onBack: () => void; onVendorRespond: (id: string, response: "accepted" | "declined" | "date_proposed") => void; onIssue: (id: string) => void; onOpenAsset: (id: string) => void; canIssueVendorWork: boolean; canSimulateVendorResponse: boolean }) {
  const store = dataset.stores.find((record) => record.id === work.storeId); const assignment = dataset.assignments.find((record) => record.workOrderId === work.id); const vendor = assignment?.partyType === "vendor" ? dataset.vendors.find((record) => record.id === assignment.partyId) : undefined; const issuance = dataset.vendorIssuances.find((record) => record.workOrderId === work.id); const visits = dataset.visits.filter((record) => record.workOrderId === work.id); const invoiceLinks = dataset.invoiceWorkLinks.filter((record) => record.workOrderId === work.id); const invoices = invoiceLinks.map((link) => dataset.invoices.find((record) => record.id === link.invoiceId)).filter(Boolean); const events = dataset.auditEvents.filter((event) => event.entityId === work.id || event.payloadSnapshot.workOrderId === work.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to work orders</button><p className="to-eyebrow">{work.number}</p><h1>{work.title}</h1><p>Store {store?.storeNumber} · {work.problemDescription}</p></div><div className="to-detail-summary"><div><span>Status</span><strong>{words(work.status)}</strong></div><div><span>Handler</span><strong>{vendor?.displayName ?? words(work.fulfillmentMode)}</strong></div><div><span>NTE</span><strong>{work.notToExceedMinor ? money(work.notToExceedMinor) : "Not used"}</strong></div><div><span>Linked cost</span><strong>{money(workOrderCost(dataset, work.id))}</strong></div></div></section><section className="to-grid two"><article className="to-panel"><header className="to-panel-head"><div><h2>Customer work order</h2><p>Operator source record and vendor billing reference</p></div><Badge value={work.status} /></header><div className="to-panel-body to-definition-list"><dl><div><dt>Store</dt><dd>#{store?.storeNumber} · {store?.normalizedAddress}</dd></div><div><dt>Requested work</dt><dd>{work.scopeOfWork}</dd></div><div><dt>Priority</dt><dd>{words(work.priority)}</dd></div><div><dt>Requested window</dt><dd>{dateLabel(work.requestedWindow.startsAt)} – {dateLabel(work.requestedWindow.endsAt)}</dd></div><div><dt>Classification</dt><dd>{work.classificationDeferred ? "Store-level now · equipment can be added later" : dataset.categories.find((category) => category.id === work.categoryId)?.label}{work.assetId ? <button className="to-link-button" type="button" onClick={() => onOpenAsset(work.assetId!)}>View linked asset <ChevronRight /></button> : null}</dd></div><div><dt>Next accountable action</dt><dd>{work.accountable?.nextAction ?? "Review and close"}</dd></div></dl></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Vendor issuance</h2><p>Versioned authorization sent outside the company</p></div>{issuance ? <Badge value={issuance.response ?? issuance.deliveryStatus} /> : <Badge value="ready_to_issue" />}</header><div className="to-panel-body">{vendor ? <><div className="to-vendor-summary"><span className="to-avatar">{initials(vendor.displayName)}</span><div><strong>{vendor.displayName}</strong><span>{vendor.specialties.map((specialty) => specialty.label).join(" · ")}</span></div></div>{issuance ? <dl className="to-mini-dl"><div><dt>Issued</dt><dd>{dateLabel(issuance.issuedAt)} · Version {issuance.version}</dd></div><div><dt>Delivery</dt><dd>{words(issuance.deliveryStatus)} by {issuance.channels.join(" + ")}</dd></div><div><dt>Vendor ticket</dt><dd>{issuance.vendorReference ?? "Not provided"}</dd></div><div><dt>Invoice instruction</dt><dd>{issuance.customerBillingInstruction}</dd></div></dl> : <><p className="to-callout">Vendor selected, but the customer work order has not been sent.</p>{canIssueVendorWork ? <button className="to-button primary to-full" type="button" onClick={() => onIssue(work.id)}><ArrowRight /> Review and send authorization</button> : <p className="to-permission-note"><ShieldCheck /> Read-only role · authorization controls are hidden.</p>}</>}{issuance && !issuance.response && issuance.acceptanceRequested !== false && canSimulateVendorResponse ? <div className="to-response-actions"><button className="to-button primary" type="button" onClick={() => onVendorRespond(work.id, "accepted")}><CheckCircle2 /> Accept</button><button className="to-button" type="button" onClick={() => onVendorRespond(work.id, "date_proposed")}><CalendarCheck /> Propose date</button><button className="to-button ghost" type="button" onClick={() => onVendorRespond(work.id, "declined")}>Decline</button></div> : null}</> : <div className="to-empty"><Users /><strong>{work.fulfillmentMode === "unassigned" ? "Handler not chosen" : "Internal work"}</strong><p>{work.accountable?.nextAction}</p></div>}</div></article></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Visit evidence</h2><p>Approximate presence context—not certified labor.</p></div></header><div className="to-panel-body"><div className="to-visit-list">{visits.length ? visits.map((visit) => <div className="to-visit" key={visit.id}><span className="to-avatar">{initials(visit.technicianName)}</span><span><strong>{visit.technicianName}</strong><span>{words(visit.evidenceStrength)} · {visit.outcome ? words(visit.outcome) : "Onsite now"}</span></span><time>{timeLabel(visit.checkedInAt)}–{visit.checkedOutAt ? timeLabel(visit.checkedOutAt) : "now"}</time></div>) : <div className="to-empty"><MapPin /><strong>No recorded visits</strong><p>A QR, secure-link, or kiosk check-in will appear here.</p></div>}</div></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Invoice and cost</h2><p>References remain separate and auditable.</p></div></header><div className="to-panel-body">{invoices.length ? invoices.map((invoice) => invoice ? <dl className="to-mini-dl" key={invoice.id}><div><dt>Vendor invoice</dt><dd>{invoice.invoiceNumber}</dd></div><div><dt>Customer WO reference</dt><dd>{invoice.customerWorkOrderReferences.join(", ") || "Missing"}</dd></div><div><dt>Amount</dt><dd>{money(invoiceTotal(dataset, invoice.id))}</dd></div><div><dt>Review state</dt><dd><Badge value={invoice.status} /></dd></div></dl> : null) : <div className="to-empty"><ReceiptText /><strong>No invoice linked yet</strong><p>The work order remains valid even when the customer does not use invoice safeguards.</p></div>}</div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Permanent timeline</h2><p>Original events and later corrections remain visible.</p></div></header><div className="to-timeline">{events.slice(0, 10).map((event) => <div key={event.id}><i /><span><strong>{event.summary}</strong><small>{dateLabel(event.occurredAt)} · {words(event.channel)}</small></span></div>)}</div></article></>;
}

function VendorDetail({ dataset, vendor, onBack, onOpenWork }: { dataset: DemoDataset; vendor: Vendor; onBack: () => void; onOpenWork: (id: string) => void }) {
  const assignmentIds = dataset.assignments.filter((record) => record.partyType === "vendor" && record.partyId === vendor.id).map((record) => record.workOrderId); const work = dataset.workOrders.filter((record) => assignmentIds.includes(record.id)); const visits = dataset.visits.filter((record) => record.vendorId === vendor.id); const accepted = dataset.vendorIssuances.filter((record) => record.vendorId === vendor.id && record.response === "accepted").length; const issued = dataset.vendorIssuances.filter((record) => record.vendorId === vendor.id).length;
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to vendors</button><p className="to-eyebrow">Approved vendor · {vendor.customerVendorNumber}</p><h1>{vendor.displayName}</h1><p>{vendor.description}</p></div><div className="to-detail-summary"><div><span>Linked spend</span><strong>{money(vendorSpend(dataset, vendor.id))}</strong></div><div><span>Active work</span><strong>{work.filter((record) => !terminalStatuses.has(record.status)).length}</strong></div><div><span>Observed visits</span><strong>{visits.length}</strong></div><div><span>Digital acceptance</span><strong>{issued ? Math.round((accepted / issued) * 100) : 0}%</strong></div></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Capabilities and coverage</h2><p>Searchable organization-owned vendor record</p></div><Badge value={vendor.status} /></header><div className="to-panel-body"><div className="to-tags">{vendor.specialties.flatMap((specialty) => [specialty.label, ...specialty.aliases.slice(0, 2)]).map((label) => <span className="to-tag" key={label}>{label}</span>)}</div><dl className="to-mini-dl"><div><dt>Regions</dt><dd>{vendor.coverageRegionIds.map((id) => dataset.regions.find((region) => region.id === id)?.name).join(", ")}</dd></div><div><dt>After-hours</dt><dd>{vendor.afterHoursAvailable ? "Available" : "Standard dispatch only"}</dd></div><div><dt>Insurance through</dt><dd>{dateLabel(vendor.insuranceExpiresOn)}</dd></div><div><dt>Portal</dt><dd>{vendor.portalEnabled ? "Optional account enabled" : "Secure links only"}</dd></div></dl></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Contacts</h2><p>Dispatch and billing remain separate.</p></div></header><div className="to-record-list">{vendor.contacts.map((contact) => <div className="to-record-row to-contact-row" key={contact.id}><span className="to-avatar">{initials(contact.name)}</span><span className="to-record-primary"><strong>{contact.name} · {words(contact.role)}</strong><span>{contact.email} · {contact.phone}</span></span><Badge value={contact.preferredChannel} label={words(contact.preferredChannel)} /></div>)}</div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Customer work issued to this vendor</h2><p>The vendor can keep using its own dispatch system.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Customer WO</th><th>Store</th><th>Problem</th><th>Vendor response</th><th>Linked cost</th></tr></thead><tbody>{work.map((record) => { const store = dataset.stores.find((entry) => entry.id === record.storeId); const issuance = dataset.vendorIssuances.find((entry) => entry.workOrderId === record.id); return <tr key={record.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenWork(record.id)}><strong>{record.number}</strong><ChevronRight /></button></td><td>#{store?.storeNumber}</td><td>{record.title}</td><td><Badge value={issuance?.response ?? issuance?.deliveryStatus ?? "ready_to_issue"} /></td><td className="to-money">{money(workOrderCost(dataset, record.id))}</td></tr>; })}</tbody></table></div></article></>;
}

function CapabilitySettings({ value, onChange }: { value: CapabilityConfig; onChange: (value: CapabilityConfig) => void }) {
  const options: Array<{ key: keyof CapabilityConfig; title: string; description: string }> = [
    { key: "vendorAcceptance", title: "Vendor response link", description: "Ask vendors to accept, decline, or propose a date. Turn it off when email issuance alone is enough." },
    { key: "locationEvidence", title: "Visit location evidence", description: "Use event-based location for QR/app activity while allowing the trusted store computer path." },
    { key: "invoiceSafeguard", title: "Invoice safeguard", description: "Match uploaded invoices to customer work orders, NTE limits, visits, and supporting evidence." },
    { key: "preventiveMaintenance", title: "Preventive maintenance", description: "Expose plans, due occurrences, vendor issuance, evidence, and compliance reporting." },
    { key: "equipmentLifecycle", title: "Equipment and lifecycle", description: "Track assets, components, warranties, repair history, and transparent capital-review rules." },
  ];
  return <div className="to-settings"><div className="to-callout"><Settings2 /><span><strong>One product, flexible adoption</strong><small>These are capability switches—not separate products or duplicate data models.</small></span></div><div className="to-setting-list">{options.map((option) => { const inputId = `capability-${option.key}`; return <label key={option.key} htmlFor={inputId}><span><strong>{option.title}</strong><small>{option.description}</small></span><input id={inputId} aria-label={option.title} type="checkbox" checked={value[option.key]} onChange={(event) => onChange({ ...value, [option.key]: event.target.checked })} /><i aria-hidden="true" /></label>; })}</div><p className="to-setting-foot">Demo changes are session-scoped. Existing records remain valid when a capability is hidden.</p></div>;
}

function StorePortal({ dataset, onWork, onVisit, onOpenIssues }: { dataset: DemoDataset; onWork: () => void; onVisit: (storeId: string) => void; onOpenIssues: () => void }) {
  const store = dataset.stores[0]; const open = dataset.workOrders.filter((record) => record.storeId === store.id && !terminalStatuses.has(record.status));
  return <div className="to-storefront"><header><span className="to-demo-pill">Store device demo</span><p>Store {store.storeNumber}</p><h3>What do you need?</h3><span>{store.address.line1}, {store.address.city}</span></header><div className="to-storefront-actions"><button type="button" onClick={onWork}><span><AlertTriangle /></span><strong>Report an issue</strong><small>Tell us what you see. No equipment knowledge required.</small><ChevronRight /></button><button type="button" onClick={() => onVisit(store.id)}><span><MapPin /></span><strong>Vendor sign in or out</strong><small>Technician self-service from this store computer.</small><ChevronRight /></button><button type="button" onClick={onOpenIssues}><span><ClipboardList /></span><strong>View open store issues</strong><small>{open.length} current items at this store.</small><ChevronRight /></button></div></div>;
}

function VisitDemo({ dataset, activeVisits, fixedStoreId, requireLocationEvidence, onCheckIn, onCheckOut }: { dataset: DemoDataset; activeVisits: Visit[]; fixedStoreId?: string; requireLocationEvidence: boolean; onCheckIn: (value: VisitCheckInValue) => ActiveVisit | void; onCheckOut: (value: VisitCheckOutValue) => void }) {
  const [storeId, setStoreId] = useState(fixedStoreId ?? dataset.stores[0]?.id ?? "");
  const [vendorId, setVendorId] = useState(dataset.vendors[0]?.id ?? "");
  const [channel, setChannel] = useState<WorkflowVisitChannel>(fixedStoreId ? "store_kiosk" : "qr");
  const [evidenceState, setEvidenceState] = useState<VisitEvidence["state"]>(fixedStoreId ? "store_kiosk_recorded" : "location_verified");
  const [activeVisitId, setActiveVisitId] = useState("new");
  const selectedActive = activeVisits.find((record) => record.id === activeVisitId);
  const activeVendor = selectedActive?.vendorId ? dataset.vendors.find((record) => record.id === selectedActive.vendorId) : undefined;
  const selectedStoreId = selectedActive?.storeId ?? fixedStoreId ?? storeId;
  const selectedVendorId = activeVendor?.id ?? vendorId;
  const store = dataset.stores.find((record) => record.id === selectedStoreId) ?? dataset.stores[0];
  const vendor = dataset.vendors.find((record) => record.id === selectedVendorId) ?? dataset.vendors[0];
  if (!store || !vendor) return null;

  const activeChannel: WorkflowVisitChannel = selectedActive
    ? selectedActive.channelStarted === "vendor_app"
      ? "app"
      : selectedActive.channelStarted === "store_kiosk"
        ? "store_kiosk"
        : selectedActive.channelStarted === "secure_work_link"
          ? "secure_link"
          : "qr"
    : channel;
  const effectiveChannel = selectedActive ? channel : activeChannel;
  const evidence: VisitEvidence = selectedActive
    ? selectedActive.evidenceStrength === "location_verified"
      ? { state: "location_verified", capturedAt: selectedActive.locationEvidence.capturedAt, accuracyMeters: selectedActive.locationEvidence.accuracyMeters, distanceMeters: selectedActive.locationEvidence.distanceFromStoreMeters }
      : selectedActive.evidenceStrength === "store_kiosk"
        ? { state: "store_kiosk_recorded", capturedAt: selectedActive.checkedInAt }
        : selectedActive.locationEvidence.verification === "outside_geofence"
          ? { state: "outside_geofence", capturedAt: selectedActive.locationEvidence.capturedAt, distanceMeters: selectedActive.locationEvidence.distanceFromStoreMeters }
          : { state: "manual_exception", capturedAt: selectedActive.checkedInAt }
    : effectiveChannel === "store_kiosk"
      ? { state: "store_kiosk_recorded", capturedAt: new Date().toISOString() }
      : { state: evidenceState, capturedAt: new Date().toISOString(), accuracyMeters: evidenceState === "location_verified" ? 18 : 80, distanceMeters: evidenceState === "location_verified" ? 24 : evidenceState === "outside_geofence" ? 1840 : undefined, note: evidenceState === "location_not_shared" ? "The browser permission was denied in this visible Demo Mode scenario." : undefined };
  const initialActiveVisit: ActiveVisit | undefined = selectedActive
    ? {
        id: selectedActive.id,
        storeId: selectedActive.storeId,
        technicianName: selectedActive.technicianName,
        vendorName: activeVendor?.displayName ?? "Outside vendor",
        workOrderId: selectedActive.workOrderId,
        noWorkOrderReason: selectedActive.purposeWhenUnmatched,
        channel: activeChannel,
        evidence,
        startedAt: selectedActive.checkedInAt,
      }
    : undefined;
  const workOrders = dataset.workOrders
    .filter((work) => work.storeId === store.id && dataset.assignments.some((assignment) => assignment.workOrderId === work.id && assignment.partyType === "vendor" && assignment.partyId === vendor.id && assignment.status !== "declined"))
    .map((work) => ({ id: work.id, number: work.number, title: work.title, storeId: work.storeId, assetLabel: work.assetId ? dataset.assets.find((asset) => asset.id === work.assetId)?.name : undefined, requestedService: work.scopeOfWork }));

  return <div className="to-visit-wrapper"><div className="to-callout"><MapPin /><span><strong>Evidence is event-based, not continuous tracking</strong><small>Demo Mode can show verified, outside-boundary, denied-permission, and trusted store-kiosk records.</small></span></div>{activeVisits.length ? <div className="to-field"><label htmlFor="active-visit">Start or end a visit</label><select id="active-visit" value={activeVisitId} onChange={(event) => setActiveVisitId(event.target.value)}><option value="new">Start a new visit</option>{activeVisits.map((visit) => { const activeStore = dataset.stores.find((record) => record.id === visit.storeId); return <option key={visit.id} value={visit.id}>Check out {visit.technicianName} · Store {activeStore?.storeNumber}</option>; })}</select></div> : null}<div className="to-visit-context"><div className="to-field"><label htmlFor="visit-channel">This event is using</label><select id="visit-channel" value={effectiveChannel} onChange={(event) => { const next = event.target.value as WorkflowVisitChannel; setChannel(next); if (next === "store_kiosk") setEvidenceState("store_kiosk_recorded"); else if (evidenceState === "store_kiosk_recorded") setEvidenceState("location_verified"); }}><option value="qr">Store QR link</option><option value="app">Vendor app</option><option value="store_kiosk">Store computer</option><option value="secure_link">Secure work-order link</option></select></div><div className="to-field"><label htmlFor="visit-store-context">Store</label><select id="visit-store-context" value={store.id} disabled={Boolean(fixedStoreId || selectedActive)} onChange={(event) => setStoreId(event.target.value)}>{dataset.stores.map((record) => <option key={record.id} value={record.id}>Store {record.storeNumber} · {record.address.city}</option>)}</select></div><div className="to-field"><label htmlFor="visit-vendor-context">Vendor</label><select id="visit-vendor-context" value={vendor.id} disabled={Boolean(selectedActive)} onChange={(event) => setVendorId(event.target.value)}>{dataset.vendors.map((record) => <option key={record.id} value={record.id}>{record.displayName}</option>)}</select></div>{effectiveChannel !== "store_kiosk" ? <div className="to-field"><label htmlFor="visit-evidence">Demo evidence result</label><select id="visit-evidence" value={evidenceState} onChange={(event) => setEvidenceState(event.target.value as VisitEvidence["state"])}><option value="location_verified">Inside store boundary</option><option value="outside_geofence">Outside store boundary</option><option value="location_not_shared">Permission denied</option><option value="manual_exception">Inaccurate / manual exception</option></select></div> : null}</div><TechnicianVisitFlow key={`${activeVisitId}-${store.id}-${vendor.id}-${effectiveChannel}-${evidence.state}`} store={{ id: store.id, storeNumber: store.storeNumber, name: store.name, address: store.normalizedAddress, regionName: dataset.regions.find((record) => record.id === store.regionId)?.name }} vendorName={vendor.displayName} workOrders={workOrders} channel={effectiveChannel} evidence={evidence} initialActiveVisit={initialActiveVisit} requireVerifiedEvidence={requireLocationEvidence && effectiveChannel !== "store_kiosk"} onCheckIn={onCheckIn} onCheckOut={onCheckOut} /></div>;
}
