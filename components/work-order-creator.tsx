"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  MapPin,
  Search,
  ShieldAlert,
  UserRoundCog,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PlatformBadge, PlatformBreadcrumbs, PlatformPageHeader } from "@/components/platform-ui";
import Link from "@/components/site-link";
import type { Asset, Component, Store, StoreSystem } from "@/lib/domain/types";
import { platformData, PLATFORM_NOW } from "@/lib/platform/data";

type StoreOption = Pick<Store, "id" | "code" | "name" | "address1" | "city" | "state" | "postalCode" | "managerName">;
type SystemOption = Pick<StoreSystem, "id" | "storeId" | "categoryId" | "code" | "name" | "location">;
type AssetOption = Pick<Asset, "id" | "storeSystemId" | "assetTag" | "name" | "location">;
type ComponentOption = Pick<Component, "id" | "assetId" | "name" | "partNumber">;
type FulfillmentMode = "internal" | "vendor" | "blended" | "unassigned";
type SlaPolicy = "emergency_1h" | "urgent_4h" | "standard_24h" | "planned_72h" | "custom";

type FormState = {
  storeId: string;
  categoryId: string;
  systemId: string;
  assetId: string;
  componentId: string;
  requestedBy: string;
  title: string;
  description: string;
  symptoms: string;
  evidenceNotes: string;
  location: string;
  problemCode: string;
  priority: "critical" | "high" | "routine" | "low";
  workType: "reactive" | "preventive" | "inspection" | "emergency" | "warranty" | "capital" | "internal";
  fulfillmentMode: FulfillmentMode;
  assignedToId: string;
  vendorId: string;
  slaPolicy: SlaPolicy;
  dueAt: string;
  estimatedHours: string;
  nteDollars: string;
  safetyRisk: "none" | "low" | "moderate" | "high";
  accessInstructions: string;
  shutdownImpact: string;
  requestedEvidence: string[];
  checklistItems: string[];
  customChecklistItem: string;
};

type RegistryRecord = Record<string, unknown> & { id?: unknown };
type CreatedWorkOrder = { id: string; number: string; status: "draft" | "approved" };

const steps = [
  { label: "Store and issue", description: "Where and what happened", icon: Building2 },
  { label: "Classification", description: "Use what is known", icon: Wrench },
  { label: "Fulfillment", description: "Choose who owns it", icon: UserRoundCog },
  { label: "Plan and evidence", description: "Set expectations", icon: ClipboardCheck },
  { label: "Review and issue", description: "Confirm the handoff", icon: FileCheck2 },
] as const;

const slaOptions: Array<{ value: SlaPolicy; label: string; response: string; completionHours?: number }> = [
  { value: "emergency_1h", label: "Emergency - respond in 1 hour", response: "1 hour response", completionHours: 4 },
  { value: "urgent_4h", label: "Urgent - respond in 4 hours", response: "4 hour response", completionHours: 24 },
  { value: "standard_24h", label: "Standard - respond in 24 hours", response: "24 hour response", completionHours: 72 },
  { value: "planned_72h", label: "Planned - respond in 3 days", response: "72 hour response", completionHours: 168 },
  { value: "custom", label: "Custom due date", response: "Custom response target" },
];

const checklistChoices = [
  "Confirm the equipment identity and update classification",
  "Review hazards and complete lockout/tagout as required",
  "Record diagnosis, failure cause and corrective action",
  "Test operation with the store contact before leaving",
  "Record labor, parts and follow-up work",
];

const evidenceChoices = ["Before and after photos", "Model and serial photo", "Readings or measurements", "Service ticket", "Store completion verification"];

function localDateTimeAfter(hours: number) {
  const date = new Date(PLATFORM_NOW);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString().slice(0, 16);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function formatDue(value: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatNte(value: string) {
  const amount = Number(value);
  if (!amount) return "No NTE set";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function dedupeById<T extends { id: string }>(seeded: T[], created: T[]) {
  const known = new Set(seeded.map((item) => item.id));
  return [...seeded, ...created.filter((item) => !known.has(item.id))];
}

export function WorkOrderCreator({
  initialReportId = "",
  initialStoreId = "",
  initialCategoryId = "",
  initialSystemId = "",
  initialAssetId = "",
  initialComponentId = "",
  initialFulfillmentMode,
  initialProviderId = "",
}: {
  initialReportId?: string;
  initialStoreId?: string;
  initialCategoryId?: string;
  initialSystemId?: string;
  initialAssetId?: string;
  initialComponentId?: string;
  initialFulfillmentMode?: FulfillmentMode;
  initialProviderId?: string;
}) {
  const initialComponent = platformData.components.find((item) => item.id === initialComponentId);
  const resolvedInitialAssetId = initialAssetId || initialComponent?.assetId || "";
  const initialAsset = platformData.assets.find((item) => item.id === resolvedInitialAssetId);
  const resolvedInitialSystemId = initialSystemId || initialAsset?.storeSystemId || "";
  const initialSystem = platformData.systems.find((item) => item.id === resolvedInitialSystemId);
  const resolvedInitialStoreId = initialStoreId || initialSystem?.storeId || "";

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    storeId: resolvedInitialStoreId,
    categoryId: initialSystem?.categoryId || initialCategoryId,
    systemId: resolvedInitialSystemId,
    assetId: resolvedInitialAssetId,
    componentId: initialComponentId,
    requestedBy: "Facilities Service Desk",
    title: "",
    description: "",
    symptoms: "",
    evidenceNotes: "",
    location: initialAsset?.location || initialSystem?.location || "",
    problemCode: "",
    priority: "routine",
    workType: "reactive",
    fulfillmentMode: initialFulfillmentMode ?? (initialProviderId ? "vendor" : "unassigned"),
    assignedToId: "",
    vendorId: initialProviderId,
    slaPolicy: "standard_24h",
    dueAt: localDateTimeAfter(72),
    estimatedHours: "2",
    nteDollars: "",
    safetyRisk: "low",
    accessInstructions: "Check in with the manager before beginning work.",
    shutdownImpact: "",
    requestedEvidence: ["Before and after photos", "Service ticket", "Store completion verification"],
    checklistItems: [...checklistChoices],
    customChecklistItem: "",
  });
  const [storeQuery, setStoreQuery] = useState("");
  const [assetChoice, setAssetChoice] = useState<"defer" | "known">(resolvedInitialAssetId ? "known" : "defer");
  const [componentChoice, setComponentChoice] = useState<"defer" | "known">(initialComponentId ? "known" : "defer");
  const [createdStores, setCreatedStores] = useState<StoreOption[]>([]);
  const [createdSystems, setCreatedSystems] = useState<SystemOption[]>([]);
  const [createdAssets, setCreatedAssets] = useState<AssetOption[]>([]);
  const [createdComponents, setCreatedComponents] = useState<ComponentOption[]>([]);
  const [submitting, setSubmitting] = useState<"draft" | "approved" | "">("");
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<CreatedWorkOrder | null>(null);

  useEffect(() => {
    const entities = ["stores", "cost-centers", "assets", "components"] as const;
    Promise.all(entities.map(async (entity) => {
      const response = await fetch(`/api/registry?entity=${entity}`);
      return await response.json() as { ok?: boolean; records?: RegistryRecord[] };
    })).then((results) => {
      const fetchedStores: StoreOption[] = (results[0].records ?? []).map((record) => ({
        id: stringValue(record.id), code: stringValue(record.code), name: stringValue(record.name),
        address1: stringValue(record.address1), city: stringValue(record.city), state: stringValue(record.state),
        postalCode: stringValue(record.postalCode), managerName: stringValue(record.managerName, "Manager not assigned"),
      })).filter((item) => item.id && item.code);
      const fetchedSystems: SystemOption[] = (results[1].records ?? []).map((record) => ({
        id: stringValue(record.id), storeId: stringValue(record.storeId), categoryId: stringValue(record.categoryId),
        code: stringValue(record.code), name: stringValue(record.name), location: stringValue(record.location),
      })).filter((item) => item.id && item.storeId);
      const fetchedAssets: AssetOption[] = (results[2].records ?? []).map((record) => ({
        id: stringValue(record.id), storeSystemId: stringValue(record.storeSystemId), assetTag: stringValue(record.assetTag),
        name: stringValue(record.name), location: stringValue(record.location),
      })).filter((item) => item.id && item.storeSystemId);
      const fetchedComponents: ComponentOption[] = (results[3].records ?? []).map((record) => ({
        id: stringValue(record.id), assetId: stringValue(record.assetId), name: stringValue(record.name), partNumber: stringValue(record.partNumber),
      })).filter((item) => item.id && item.assetId);
      if (results[0].ok) {
        setCreatedStores(fetchedStores);
      }
      if (results[1].ok) {
        setCreatedSystems(fetchedSystems);
      }
      if (results[2].ok) {
        setCreatedAssets(fetchedAssets);
      }
      if (results[3].ok) {
        setCreatedComponents(fetchedComponents);
      }
      if (initialSystemId || initialAssetId || initialComponentId) {
        const component = [...platformData.components, ...fetchedComponents].find((item) => item.id === initialComponentId);
        const asset = [...platformData.assets, ...fetchedAssets].find((item) => item.id === (initialAssetId || component?.assetId));
        const system = [...platformData.systems, ...fetchedSystems].find((item) => item.id === (initialSystemId || asset?.storeSystemId));
        setForm((current) => ({
          ...current,
          storeId: current.storeId || initialStoreId || system?.storeId || "",
          categoryId: current.categoryId || system?.categoryId || "",
          systemId: current.systemId || system?.id || "",
          assetId: current.assetId || asset?.id || "",
          componentId: current.componentId || component?.id || "",
          location: current.location || asset?.location || system?.location || "",
        }));
        if (asset) setAssetChoice("known");
        if (component) setComponentChoice("known");
      }
    }).catch(() => undefined);
  }, [initialAssetId, initialComponentId, initialStoreId, initialSystemId]);

  useEffect(() => {
    if (!initialReportId) return;
    fetch("/api/registry?entity=requests").then((response) => response.json()).then((raw) => {
      const result = raw as { ok?: boolean; records?: RegistryRecord[] };
      const report = result.records?.find((item) => stringValue(item.id) === initialReportId);
      if (!report) return;
      const reportDescription = stringValue(report.originalDescription);
      const reportArea = stringValue(report.area, "Store area");
      const reportUrgency = stringValue(report.urgency, "routine") as FormState["priority"];
      setForm((current) => ({
        ...current,
        storeId: current.storeId || stringValue(report.storeId),
        requestedBy: stringValue(report.reporterName, "Store team member"),
        title: current.title || `${reportArea}: ${reportDescription.slice(0, 100)}`,
        description: current.description || reportDescription,
        symptoms: current.symptoms || reportDescription,
        location: current.location || reportArea,
        priority: ["critical", "high", "routine", "low"].includes(reportUrgency) ? reportUrgency : "routine",
      }));
    }).catch(() => undefined);
  }, [initialReportId]);

  const allStores = useMemo(() => dedupeById<StoreOption>(platformData.stores, createdStores), [createdStores]);
  const allSystems = useMemo(() => dedupeById<SystemOption>(platformData.systems, createdSystems), [createdSystems]);
  const allAssets = useMemo(() => dedupeById<AssetOption>(platformData.assets, createdAssets), [createdAssets]);
  const allComponents = useMemo(() => dedupeById<ComponentOption>(platformData.components, createdComponents), [createdComponents]);

  const selectedStore = allStores.find((item) => item.id === form.storeId);
  const selectedCategory = platformData.categories.find((item) => item.id === form.categoryId);
  const selectedSystem = allSystems.find((item) => item.id === form.systemId);
  const selectedAsset = allAssets.find((item) => item.id === form.assetId);
  const selectedComponent = allComponents.find((item) => item.id === form.componentId);
  const selectedTechnician = platformData.technicians.find((item) => item.id === form.assignedToId);
  const selectedVendor = platformData.vendors.find((item) => item.id === form.vendorId);

  const matchingStores = useMemo(() => {
    const query = storeQuery.trim().toLowerCase();
    const matches = query
      ? allStores.filter((store) => `${store.code} ${store.name} ${store.address1} ${store.city} ${store.state} ${store.postalCode}`.toLowerCase().includes(query))
      : allStores;
    return matches.slice(0, 8);
  }, [allStores, storeQuery]);
  const systems = allSystems.filter((item) => item.storeId === form.storeId && (!form.categoryId || item.categoryId === form.categoryId));
  const assets = allAssets.filter((item) => item.storeSystemId === form.systemId);
  const components = allComponents.filter((item) => item.assetId === form.assetId);
  const classificationDepth = form.componentId ? 5 : form.assetId ? 4 : form.systemId ? 3 : form.categoryId ? 2 : form.storeId ? 1 : 0;
  const sla = slaOptions.find((item) => item.value === form.slaPolicy) ?? slaOptions[2];

  function patchForm(values: Partial<FormState>) {
    setForm((current) => ({ ...current, ...values }));
    setMessage("");
  }

  function chooseStore(store: StoreOption) {
    patchForm({ storeId: store.id, categoryId: "", systemId: "", assetId: "", componentId: "", location: "" });
    setStoreQuery("");
    setAssetChoice("defer");
    setComponentChoice("defer");
  }

  function chooseCategory(categoryId: string) {
    patchForm({ categoryId, systemId: "", assetId: "", componentId: "" });
    setAssetChoice("defer");
    setComponentChoice("defer");
  }

  function chooseSystem(systemId: string) {
    const system = allSystems.find((item) => item.id === systemId);
    patchForm({ systemId, categoryId: system?.categoryId || form.categoryId, assetId: "", componentId: "", location: system?.location || form.location });
    setAssetChoice("defer");
    setComponentChoice("defer");
  }

  function chooseAsset(assetId: string) {
    const asset = allAssets.find((item) => item.id === assetId);
    patchForm({ assetId, componentId: "", location: asset?.location || form.location });
    setComponentChoice("defer");
  }

  function setSlaPolicy(policy: SlaPolicy) {
    const option = slaOptions.find((item) => item.value === policy);
    patchForm({ slaPolicy: policy, ...(option?.completionHours ? { dueAt: localDateTimeAfter(option.completionHours) } : {}) });
  }

  function setPriority(priority: FormState["priority"]) {
    const policy: SlaPolicy = priority === "critical" ? "emergency_1h" : priority === "high" ? "urgent_4h" : priority === "low" ? "planned_72h" : "standard_24h";
    patchForm({ priority });
    setSlaPolicy(policy);
  }

  function toggleList(field: "requestedEvidence" | "checklistItems", value: string) {
    setForm((current) => {
      const list = current[field];
      return { ...current, [field]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] };
    });
    setMessage("");
  }

  function addChecklistItem() {
    const item = form.customChecklistItem.trim();
    if (!item || form.checklistItems.includes(item)) return;
    patchForm({ checklistItems: [...form.checklistItems, item], customChecklistItem: "" });
  }

  function validateCore() {
    if (!form.storeId) return "Choose the store where the work is needed.";
    if (form.requestedBy.trim().length < 2) return "Enter who requested the work.";
    if (form.title.trim().length < 3) return "Add a short problem title.";
    if (form.description.trim().length < 5) return "Describe the problem and its operational impact.";
    return "";
  }

  function goNext() {
    if (step === 0) {
      const issue = validateCore();
      if (issue) { setMessage(issue); return; }
    }
    setMessage("");
    setStep((current) => Math.min(4, current + 1));
  }

  async function submit(status: "draft" | "approved") {
    const issue = validateCore();
    if (issue) { setMessage(issue); setStep(0); return; }
    setSubmitting(status);
    setMessage("");
    const assignedToName = form.fulfillmentMode === "internal"
      ? selectedTechnician?.name
      : form.fulfillmentMode === "vendor"
        ? selectedVendor?.name
        : form.fulfillmentMode === "blended"
          ? [selectedTechnician?.name, selectedVendor?.shortName].filter(Boolean).join(" + ")
          : "";
    const detail = [
      form.description.trim(),
      form.symptoms.trim() && `Observed symptoms: ${form.symptoms.trim()}`,
      form.evidenceNotes.trim() && `Evidence already available: ${form.evidenceNotes.trim()}`,
      form.requestedEvidence.length && `Required evidence: ${form.requestedEvidence.join("; ")}.`,
      form.checklistItems.length && `Completion checklist: ${form.checklistItems.join("; ")}.`,
    ].filter(Boolean).join("\n\n");
    const access = [
      form.accessInstructions.trim(),
      form.shutdownImpact.trim() && `Operational impact / shutdown: ${form.shutdownImpact.trim()}`,
      `SLA: ${sla.response}; target completion ${formatDue(form.dueAt)}.`,
    ].filter(Boolean).join("\n");
    try {
      const response = await fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "work-orders",
          data: {
            reportId: initialReportId || undefined,
            storeId: form.storeId,
            categoryId: form.categoryId || "unclassified",
            systemId: form.systemId || undefined,
            assetId: form.assetId || undefined,
            componentId: form.componentId || undefined,
            title: form.title.trim(),
            description: detail,
            location: form.location.trim(),
            problemCode: form.problemCode.trim(),
            requestedBy: form.requestedBy.trim(),
            priority: form.priority,
            workType: form.workType,
            status,
            assignmentType: form.fulfillmentMode,
            assignedToId: form.assignedToId || undefined,
            assignedToName,
            vendorId: form.vendorId || undefined,
            dueAt: form.dueAt || undefined,
            estimatedHours: Number(form.estimatedHours) || 0,
            safetyRisk: form.safetyRisk,
            accessInstructions: access,
            nteCents: Math.round((Number(form.nteDollars) || 0) * 100),
            classificationDeferred: !form.categoryId || !form.systemId || !form.assetId || !form.componentId,
            slaPolicy: form.slaPolicy,
            requestedEvidence: form.requestedEvidence,
            checklistItems: form.checklistItems,
          },
        }),
      });
      const result = await response.json() as { ok?: boolean; id?: string; number?: string; error?: string };
      if (!response.ok || !result.ok || !result.id || !result.number) throw new Error(result.error || "Unable to create work order");
      setCreated({ id: result.id, number: result.number, status });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create work order");
    } finally {
      setSubmitting("");
    }
  }

  if (created) {
    return (
      <AppShell><main className="pf-page wo-create-success-page">
        <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Work orders", href: "/work-orders" }, { label: created.number }]} />
        <section className="wo-create-success">
          <span><CheckCircle2 /></span>
          <PlatformBadge tone="good">{created.status === "draft" ? "Draft saved" : "Work order issued"}</PlatformBadge>
          <h1>{created.number} is ready for the maintenance team.</h1>
          <p>{created.status === "draft" ? "The record is in the planning queue for scope review and assignment." : "The accountable party can now acknowledge, schedule, diagnose and complete the work from one connected record."}</p>
          {classificationDepth < 5 && <div className="wo-create-success-note"><Wrench /><span><strong>Classification remains flexible.</strong> Any equipment left open can be identified during diagnosis without changing the original request.</span></div>}
          <div className="wo-create-success-actions">
            <Link className="pf-primary-button" href={`/work-orders/${created.id}`}>Open work order <ArrowRight /></Link>
            <Link className="pf-secondary-button" href="/work-orders">Return to work orders</Link>
          </div>
        </section>
      </main></AppShell>
    );
  }

  return (
    <AppShell><main className="pf-page wo-create-page">
      <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Work orders", href: "/work-orders" }, { label: "Create" }]} />
      <PlatformPageHeader eyebrow="Manager work intake" title="Create a work order that is ready to act on." description="Start with the store and problem. Equipment depth, assignment and financial controls can be added now or completed by the accountable owner later.">
        <Link className="pf-secondary-button" href="/work-orders"><ArrowLeft />Cancel</Link>
      </PlatformPageHeader>

      <div className="wo-create-layout">
        <nav className="wo-create-steps" aria-label="Work order creation steps">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return <button type="button" key={item.label} className={index === step ? "active" : index < step ? "complete" : ""} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}><i>{index < step ? <Check /> : <Icon />}</i><span><strong>{item.label}</strong><small>{item.description}</small></span></button>;
          })}
        </nav>

        <form className="wo-create-form" onSubmit={(event) => { event.preventDefault(); if (step < 4) goNext(); else void submit("approved"); }}>
          <section className="wo-create-card">
            <header className="wo-create-card-head"><span>Step {step + 1} of {steps.length}</span><h2>{steps[step].label}</h2><p>{steps[step].description}</p></header>

            {step === 0 && <div className="wo-create-card-body">
              <div className="wo-create-section-heading"><div><h3>Which store needs work?</h3><p>Search by store number, name, street address, city or ZIP.</p></div><PlatformBadge tone={selectedStore ? "good" : "warning"}>{selectedStore ? "Store selected" : "Required"}</PlatformBadge></div>
              {selectedStore ? <div className="wo-create-selected-store"><MapPin /><div><strong>Store {selectedStore.code} - {selectedStore.name}</strong><span>{selectedStore.address1}, {selectedStore.city}, {selectedStore.state} {selectedStore.postalCode}</span><small>Manager: {selectedStore.managerName}</small></div><button type="button" onClick={() => patchForm({ storeId: "", categoryId: "", systemId: "", assetId: "", componentId: "" })}>Change store</button></div> : <div className="wo-create-store-picker"><label><Search /><input value={storeQuery} onChange={(event) => setStoreQuery(event.target.value)} placeholder="Try 45, Philadelphia, or Market Street" aria-label="Search stores" /></label><div className="wo-create-store-results" role="listbox" aria-label="Matching stores">{matchingStores.map((store) => <button type="button" role="option" aria-selected="false" key={store.id} onClick={() => chooseStore(store)}><span><strong>Store {store.code}</strong><small>{store.name}</small></span><span>{store.address1}<small>{store.city}, {store.state} {store.postalCode}</small></span><ChevronRight /></button>)}{!matchingStores.length && <p>No stores match this search.</p>}</div></div>}

              <div className="wo-create-divider" />
              <div className="wo-create-fields two-column">
                <label><span>Requested by <b>*</b></span><input value={form.requestedBy} onChange={(event) => patchForm({ requestedBy: event.target.value })} placeholder="Person or service desk" /></label>
                <label><span>Exact area or location</span><input value={form.location} onChange={(event) => patchForm({ location: event.target.value })} placeholder="Beer cave, rear sales floor" /></label>
                <label className="wide"><span>Problem title <b>*</b></span><input value={form.title} onChange={(event) => patchForm({ title: event.target.value })} placeholder="Beer cave temperature rising above setpoint" /></label>
                <label className="wide"><span>What is happening and how is the store affected? <b>*</b></span><textarea rows={4} value={form.description} onChange={(event) => patchForm({ description: event.target.value })} placeholder="Describe when it started, operational impact, alarms and anything already attempted." /></label>
                <label className="wide"><span>Observed symptoms</span><textarea rows={3} value={form.symptoms} onChange={(event) => patchForm({ symptoms: event.target.value })} placeholder="Example: box is 49 F, condenser fan is not turning, product has been moved." /></label>
                <label className="wide"><span>Evidence already available</span><input value={form.evidenceNotes} onChange={(event) => patchForm({ evidenceNotes: event.target.value })} placeholder="Photo from manager, alarm log, prior service ticket, temperature reading" /></label>
              </div>
            </div>}

            {step === 1 && <div className="wo-create-card-body">
              <div className="wo-create-defer-banner"><Wrench /><div><strong>Equipment is never required to open legitimate work.</strong><p>Select only what is known. Use Identify during diagnosis and the technician or vendor can classify the record later.</p></div></div>
              <div className="wo-create-fields two-column">
                <label><span>Maintenance category</span><select value={form.categoryId} onChange={(event) => chooseCategory(event.target.value)}><option value="">Classify during triage</option>{platformData.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small>Optional. Used for routing and category reporting.</small></label>
                <label><span>Equipment group / system</span><select value={form.systemId} onChange={(event) => chooseSystem(event.target.value)} disabled={!form.storeId}><option value="">Identify during triage</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.code} - {system.name} - {system.location}</option>)}</select><small>Optional. Selecting a system also sets its category.</small></label>
              </div>

              <div className="wo-create-choice-section"><div><h3>Asset</h3><p>Can the requester identify the individual maintainable asset?</p></div><div className="wo-create-choice-grid"><button type="button" className={assetChoice === "defer" ? "selected" : ""} onClick={() => { setAssetChoice("defer"); setComponentChoice("defer"); patchForm({ assetId: "", componentId: "" }); }}><i><Wrench /></i><span><strong>Identify during diagnosis</strong><small>Create the work order without an asset.</small></span>{assetChoice === "defer" && <Check />}</button><button type="button" disabled={!form.systemId || !assets.length} className={assetChoice === "known" ? "selected" : ""} onClick={() => setAssetChoice("known")}><i><CheckCircle2 /></i><span><strong>Select a known asset</strong><small>{!form.systemId ? "Choose a system first" : assets.length ? `${assets.length} assets available` : "No assets configured"}</small></span>{assetChoice === "known" && <Check />}</button></div>{assetChoice === "known" && <label className="wo-create-inline-field"><span>Known asset</span><select value={form.assetId} onChange={(event) => chooseAsset(event.target.value)}><option value="">Choose an asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} - {asset.name} - {asset.location}</option>)}</select></label>}</div>

              <div className="wo-create-choice-section"><div><h3>Component</h3><p>Go deeper only when the failed part is already known.</p></div><div className="wo-create-choice-grid"><button type="button" className={componentChoice === "defer" ? "selected" : ""} onClick={() => { setComponentChoice("defer"); patchForm({ componentId: "" }); }}><i><Wrench /></i><span><strong>Identify during diagnosis</strong><small>Create the work order without a component.</small></span>{componentChoice === "defer" && <Check />}</button><button type="button" disabled={!form.assetId || !components.length} className={componentChoice === "known" ? "selected" : ""} onClick={() => setComponentChoice("known")}><i><CheckCircle2 /></i><span><strong>Select a known component</strong><small>{!form.assetId ? "Choose an asset first" : components.length ? `${components.length} components available` : "No components configured"}</small></span>{componentChoice === "known" && <Check />}</button></div>{componentChoice === "known" && <label className="wo-create-inline-field"><span>Known component</span><select value={form.componentId} onChange={(event) => patchForm({ componentId: event.target.value })}><option value="">Choose a component</option>{components.map((component) => <option key={component.id} value={component.id}>{component.name}{component.partNumber ? ` - ${component.partNumber}` : ""}</option>)}</select></label>}</div>

              <div className="wo-create-classification"><span className="done">Store {selectedStore?.code ?? "required"}</span><ChevronRight /><span className={form.categoryId ? "done" : "deferred"}>{selectedCategory?.name ?? "Category deferred"}</span><ChevronRight /><span className={form.systemId ? "done" : "deferred"}>{selectedSystem?.name ?? "System deferred"}</span><ChevronRight /><span className={form.assetId ? "done" : "deferred"}>{selectedAsset?.assetTag ?? "Asset deferred"}</span><ChevronRight /><span className={form.componentId ? "done" : "deferred"}>{selectedComponent?.name ?? "Component deferred"}</span></div>
            </div>}

            {step === 2 && <div className="wo-create-card-body">
              <div className="wo-create-section-heading"><div><h3>Who should own the next action?</h3><p>Internal and outside work share the same lifecycle and accountability record.</p></div><PlatformBadge tone={form.fulfillmentMode === "unassigned" ? "warning" : "good"}>{form.fulfillmentMode === "unassigned" ? "Dispatch owns next action" : "Fulfillment selected"}</PlatformBadge></div>
              <div className="wo-create-mode-grid">{([
                ["unassigned", "Dispatch queue", "Leave assignment open; Maintenance Dispatch remains accountable."],
                ["internal", "Internal team", "Assign or queue the work for an employee technician."],
                ["vendor", "Outside provider", "Issue the same work order to a contracted provider."],
                ["blended", "Blended", "An internal owner coordinates work with an outside provider."],
              ] as Array<[FulfillmentMode, string, string]>).map(([value, label, description]) => <button type="button" key={value} className={form.fulfillmentMode === value ? "selected" : ""} onClick={() => patchForm({ fulfillmentMode: value, assignedToId: "", vendorId: "" })}><i>{form.fulfillmentMode === value ? <Check /> : <UserRoundCog />}</i><span><strong>{label}</strong><small>{description}</small></span></button>)}</div>
              <div className="wo-create-fields two-column wo-create-assignment-fields">
                {(form.fulfillmentMode === "internal" || form.fulfillmentMode === "blended") && <label><span>Internal assignee or team</span><select value={form.assignedToId} onChange={(event) => patchForm({ assignedToId: event.target.value })}><option value="">Assign during dispatch</option>{platformData.technicians.filter((person) => person.employmentType === "internal").map((person) => <option key={person.id} value={person.id}>{person.name} - {person.title} - {person.trades.join(" / ")}</option>)}</select><small>Optional. If open, Maintenance Dispatch remains accountable.</small></label>}
                {(form.fulfillmentMode === "vendor" || form.fulfillmentMode === "blended") && <label><span>Outside provider</span><select value={form.vendorId} onChange={(event) => patchForm({ vendorId: event.target.value })}><option value="">Select during dispatch</option>{platformData.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.shortName} - {vendor.trade}</option>)}</select><small>Optional. Portal adoption is not required to receive or update work.</small></label>}
              </div>
              <div className="wo-create-accountability"><ShieldAlert /><div><strong>Accountability does not depend on the interaction channel.</strong><p>The assignee can respond through the internal queue, vendor portal, secure email link, QR flow or a manager-recorded phone update. Every response becomes part of the same audit history.</p></div></div>
            </div>}

            {step === 3 && <div className="wo-create-card-body">
              <div className="wo-create-fields three-column">
                <label><span>Priority</span><select value={form.priority} onChange={(event) => setPriority(event.target.value as FormState["priority"])}><option value="critical">Critical - safety or operation stopped</option><option value="high">High - major degradation</option><option value="routine">Routine - standard response</option><option value="low">Low - planned or cosmetic</option></select></label>
                <label><span>SLA policy</span><select value={form.slaPolicy} onChange={(event) => setSlaPolicy(event.target.value as SlaPolicy)}>{slaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label><span>Target completion</span><input type="datetime-local" value={form.dueAt} onChange={(event) => patchForm({ dueAt: event.target.value, slaPolicy: "custom" })} /></label>
                <label><span>Work type</span><select value={form.workType} onChange={(event) => patchForm({ workType: event.target.value as FormState["workType"] })}><option value="reactive">Reactive repair</option><option value="emergency">Emergency</option><option value="preventive">Preventive maintenance</option><option value="inspection">Inspection</option><option value="warranty">Warranty</option><option value="capital">Capital work</option><option value="internal">Internal maintenance</option></select></label>
                <label><span>Estimated labor hours</span><input type="number" min="0" step="0.25" value={form.estimatedHours} onChange={(event) => patchForm({ estimatedHours: event.target.value })} /></label>
                <label><span>Not-to-exceed amount</span><div className="wo-create-money-input"><CircleDollarSign /><input type="number" min="0" step="1" value={form.nteDollars} onChange={(event) => patchForm({ nteDollars: event.target.value })} placeholder="No NTE" /></div><small>Optional authorization ceiling; this is not an invoice.</small></label>
                <label><span>Safety risk</span><select value={form.safetyRisk} onChange={(event) => patchForm({ safetyRisk: event.target.value as FormState["safetyRisk"] })}><option value="none">None identified</option><option value="low">Low</option><option value="moderate">Moderate - review before work</option><option value="high">High - safety approval required</option></select></label>
                <label><span>Problem or failure code</span><input value={form.problemCode} onChange={(event) => patchForm({ problemCode: event.target.value })} placeholder="Optional, such as HIGH-TEMP" /></label>
                <label className="wide"><span>Access and safety instructions</span><textarea rows={3} value={form.accessInstructions} onChange={(event) => patchForm({ accessInstructions: event.target.value })} placeholder="Check-in contact, entrance, keys, permits, PPE and lockout requirements" /></label>
                <label className="wide"><span>Operational impact or shutdown plan</span><textarea rows={3} value={form.shutdownImpact} onChange={(event) => patchForm({ shutdownImpact: event.target.value })} placeholder="What can be shut down, protected product, customer impact and approved work window" /></label>
              </div>

              <div className="wo-create-check-grid"><section><header><h3>Evidence required</h3><p>Choose what must be returned with the work.</p></header>{evidenceChoices.map((item) => <label key={item}><input type="checkbox" checked={form.requestedEvidence.includes(item)} onChange={() => toggleList("requestedEvidence", item)} /><span><Check />{item}</span></label>)}</section><section><header><h3>Completion checklist</h3><p>These expectations travel with the assignment.</p></header>{checklistChoices.map((item) => <label key={item}><input type="checkbox" checked={form.checklistItems.includes(item)} onChange={() => toggleList("checklistItems", item)} /><span><Check />{item}</span></label>)}{form.checklistItems.filter((item) => !checklistChoices.includes(item)).map((item) => <label key={item}><input type="checkbox" checked onChange={() => toggleList("checklistItems", item)} /><span><Check />{item}</span></label>)}<div className="wo-create-add-check"><input value={form.customChecklistItem} onChange={(event) => patchForm({ customChecklistItem: event.target.value })} placeholder="Add a custom checklist item" /><button type="button" onClick={addChecklistItem}>Add</button></div></section></div>
            </div>}

            {step === 4 && <div className="wo-create-card-body">
              <div className="wo-create-review-hero"><FileCheck2 /><div><span>Ready to issue</span><h3>{form.title || "Untitled work order"}</h3><p>Review the operational handoff below. Save a draft for planning or issue it into the accountable maintenance queue.</p></div></div>
              <div className="wo-create-review-grid">
                <section><header><h3>Store and issue</h3><button type="button" onClick={() => setStep(0)}>Edit</button></header><dl><div><dt>Store</dt><dd>Store {selectedStore?.code} - {selectedStore?.name}</dd></div><div><dt>Requested by</dt><dd>{form.requestedBy}</dd></div><div><dt>Location</dt><dd>{form.location || "Confirm onsite"}</dd></div><div><dt>Problem</dt><dd>{form.description}</dd></div></dl></section>
                <section><header><h3>Classification</h3><button type="button" onClick={() => setStep(1)}>Edit</button></header><dl><div><dt>Category</dt><dd>{selectedCategory?.name || "Classify during triage"}</dd></div><div><dt>System</dt><dd>{selectedSystem?.name || "Identify during triage"}</dd></div><div><dt>Asset</dt><dd>{selectedAsset ? `${selectedAsset.assetTag} - ${selectedAsset.name}` : "Identify during diagnosis"}</dd></div><div><dt>Component</dt><dd>{selectedComponent?.name || "Identify during diagnosis"}</dd></div></dl></section>
                <section><header><h3>Fulfillment</h3><button type="button" onClick={() => setStep(2)}>Edit</button></header><dl><div><dt>Mode</dt><dd>{form.fulfillmentMode === "unassigned" ? "Dispatch queue" : form.fulfillmentMode}</dd></div><div><dt>Internal owner</dt><dd>{selectedTechnician?.name || (form.fulfillmentMode === "internal" || form.fulfillmentMode === "blended" ? "Assign during dispatch" : "Not applicable")}</dd></div><div><dt>Provider</dt><dd>{selectedVendor?.name || (form.fulfillmentMode === "vendor" || form.fulfillmentMode === "blended" ? "Select during dispatch" : "Not applicable")}</dd></div></dl></section>
                <section><header><h3>Controls and proof</h3><button type="button" onClick={() => setStep(3)}>Edit</button></header><dl><div><dt>Priority / SLA</dt><dd>{form.priority} - {sla.response}</dd></div><div><dt>Due</dt><dd>{formatDue(form.dueAt)}</dd></div><div><dt>NTE</dt><dd>{formatNte(form.nteDollars)}</dd></div><div><dt>Safety</dt><dd>{form.safetyRisk}</dd></div><div><dt>Evidence</dt><dd>{form.requestedEvidence.length ? form.requestedEvidence.join(", ") : "No required evidence selected"}</dd></div><div><dt>Checklist</dt><dd>{form.checklistItems.length} required steps</dd></div></dl></section>
              </div>
              {classificationDepth < 5 && <div className="wo-create-review-note"><CheckCircle2 /><div><strong>Deferred equipment will not block this work order.</strong><p>The record opens with explicit unclassified depth. Its accountable owner can identify the category, system, asset or component during triage and diagnosis.</p></div></div>}
            </div>}

            {message && <div className="wo-create-error" role="alert"><ShieldAlert />{message}</div>}
            <footer className="wo-create-footer"><div>{step > 0 && <button type="button" className="pf-secondary-button" onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft />Back</button>}</div><div>{step === 4 && <button type="button" className="pf-secondary-button" disabled={Boolean(submitting)} onClick={() => void submit("draft")}>{submitting === "draft" ? "Saving..." : "Save draft"}</button>}<button type="submit" className="pf-primary-button" disabled={Boolean(submitting)}>{step < 4 ? <>Continue <ArrowRight /></> : submitting === "approved" ? "Issuing..." : <>Issue work order <ArrowRight /></>}</button></div></footer>
          </section>
        </form>

        <aside className="wo-create-summary">
          <header><span>Live handoff summary</span><strong>{form.title || "New maintenance work"}</strong></header>
          <div><small>Store</small><strong>{selectedStore ? `Store ${selectedStore.code}` : "Not selected"}</strong><span>{selectedStore ? `${selectedStore.city}, ${selectedStore.state}` : "Required before review"}</span></div>
          <div><small>Classification</small><strong>{selectedCategory?.name || "Classify later"}</strong><span>{classificationDepth} of 5 levels identified</span><i><b style={{ width: `${classificationDepth * 20}%` }} /></i></div>
          <div><small>Accountable next action</small><strong>{selectedTechnician?.name || selectedVendor?.shortName || "Maintenance Dispatch"}</strong><span>{form.fulfillmentMode === "unassigned" ? "Assignment remains open" : `${form.fulfillmentMode} fulfillment`}</span></div>
          <div className="wo-create-summary-pair"><span><small>Due</small><strong>{formatDue(form.dueAt)}</strong></span><span><small>NTE</small><strong>{formatNte(form.nteDollars)}</strong></span></div>
          <footer><CalendarClock /><span><strong>{sla.response}</strong><small>{form.priority} priority</small></span></footer>
        </aside>
      </div>
    </main></AppShell>
  );
}
