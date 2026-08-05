"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import Link from "@/components/site-link";
import { PlatformBadge, PlatformBreadcrumbs, PlatformPageHeader } from "@/components/platform-ui";
import type { Asset, Store, StoreSystem } from "@/lib/domain/types";
import { PLATFORM_NOW, platformData } from "@/lib/platform/data";

type StoreOption = Pick<Store, "id" | "code" | "name" | "address1" | "city" | "state" | "postalCode">;
type SystemOption = Pick<StoreSystem, "id" | "storeId" | "categoryId" | "code" | "name" | "location">;
type AssetOption = Pick<Asset, "id" | "storeSystemId" | "assetTag" | "name" | "location" | "manufacturer" | "model">;
type TargetType = "system" | "asset";
type Frequency = "monthly" | "quarterly" | "semiannual" | "annual";

type FormState = {
  storeId: string;
  categoryId: string;
  targetType: TargetType;
  targetId: string;
  name: string;
  description: string;
  frequency: Frequency;
  startAt: string;
  vendorId: string;
  requiredDocument: string;
};

type RegistryRecord = Record<string, unknown>;
type CreatedPlan = { id: string; occurrenceId: string };

const steps = [
  { label: "Scope", description: "Choose the location and equipment", icon: Wrench },
  { label: "Plan", description: "Set cadence, ownership and proof", icon: CalendarClock },
  { label: "Review", description: "Confirm the first occurrence", icon: FileCheck2 },
] as const;

const frequencyOptions: Array<{ value: Frequency; label: string; note: string }> = [
  { value: "monthly", label: "Monthly", note: "12 occurrences per year" },
  { value: "quarterly", label: "Quarterly", note: "4 occurrences per year" },
  { value: "semiannual", label: "Semiannual", note: "2 occurrences per year" },
  { value: "annual", label: "Annual", note: "1 occurrence per year" },
];

const documentPresets = [
  "Completed checklist and service evidence",
  "Service report with readings and photos",
  "Inspection checklist and deficiency log",
  "Compliance certificate and technician signature",
];

function defaultStartDate() {
  const date = new Date(PLATFORM_NOW);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function dedupeById<T extends { id: string }>(seeded: T[], created: T[]) {
  const result = new Map<string, T>();
  for (const item of [...seeded, ...created]) result.set(item.id, item);
  return [...result.values()];
}

function formatDate(value: string) {
  if (!value) return "Not scheduled";
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function PmPlanCreator({
  initialStoreId = "",
  initialCategoryId = "",
  initialTargetType = "system",
  initialTargetId = "",
}: {
  initialStoreId?: string;
  initialCategoryId?: string;
  initialTargetType?: TargetType;
  initialTargetId?: string;
}) {
  const initialAsset = initialTargetType === "asset" ? platformData.assets.find((asset) => asset.id === initialTargetId) : undefined;
  const initialSystem = platformData.systems.find((system) => system.id === (initialTargetType === "system" ? initialTargetId : initialAsset?.storeSystemId));
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    storeId: initialStoreId || initialSystem?.storeId || "",
    categoryId: initialCategoryId || initialSystem?.categoryId || "",
    targetType: initialTargetType,
    targetId: initialTargetId,
    name: "",
    description: "",
    frequency: "quarterly",
    startAt: defaultStartDate(),
    vendorId: "",
    requiredDocument: documentPresets[1],
  });
  const [storeQuery, setStoreQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [createdStores, setCreatedStores] = useState<StoreOption[]>([]);
  const [createdSystems, setCreatedSystems] = useState<SystemOption[]>([]);
  const [createdAssets, setCreatedAssets] = useState<AssetOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<CreatedPlan | null>(null);

  useEffect(() => {
    Promise.all(["stores", "cost-centers", "assets"].map(async (entity) => {
      const response = await fetch(`/api/registry?entity=${entity}`);
      return await response.json() as { ok?: boolean; records?: RegistryRecord[] };
    })).then(([storesResult, systemsResult, assetsResult]) => {
      if (storesResult.ok) {
        setCreatedStores((storesResult.records ?? []).map((record) => ({
          id: stringValue(record.id),
          code: stringValue(record.code),
          name: stringValue(record.name),
          address1: stringValue(record.address1),
          city: stringValue(record.city),
          state: stringValue(record.state),
          postalCode: stringValue(record.postalCode),
        })).filter((store) => store.id && store.code));
      }
      if (systemsResult.ok) {
        setCreatedSystems((systemsResult.records ?? []).map((record) => ({
          id: stringValue(record.id),
          storeId: stringValue(record.storeId),
          categoryId: stringValue(record.categoryId),
          code: stringValue(record.code),
          name: stringValue(record.name),
          location: stringValue(record.location),
        })).filter((system) => system.id && system.storeId));
      }
      if (assetsResult.ok) {
        setCreatedAssets((assetsResult.records ?? []).map((record) => ({
          id: stringValue(record.id),
          storeSystemId: stringValue(record.storeSystemId),
          assetTag: stringValue(record.assetTag),
          name: stringValue(record.name),
          location: stringValue(record.location),
          manufacturer: stringValue(record.manufacturer),
          model: stringValue(record.model),
        })).filter((asset) => asset.id && asset.storeSystemId));
      }
    }).catch(() => undefined);
  }, []);

  const allStores = useMemo(() => dedupeById<StoreOption>(platformData.stores, createdStores), [createdStores]);
  const allSystems = useMemo(() => dedupeById<SystemOption>(platformData.systems, createdSystems), [createdSystems]);
  const allAssets = useMemo(() => dedupeById<AssetOption>(platformData.assets, createdAssets), [createdAssets]);
  const selectedStore = allStores.find((store) => store.id === form.storeId);
  const selectedCategory = platformData.categories.find((category) => category.id === form.categoryId);
  const selectedSystem = form.targetType === "system"
    ? allSystems.find((system) => system.id === form.targetId)
    : allSystems.find((system) => system.id === allAssets.find((asset) => asset.id === form.targetId)?.storeSystemId);
  const selectedAsset = form.targetType === "asset" ? allAssets.find((asset) => asset.id === form.targetId) : undefined;
  const selectedVendor = platformData.vendors.find((vendor) => vendor.id === form.vendorId);
  const selectedTargetName = selectedAsset?.name ?? selectedSystem?.name ?? "No target selected";

  const matchingStores = useMemo(() => {
    const query = storeQuery.trim().toLowerCase();
    return allStores.filter((store) => !query || `${store.code} ${store.name} ${store.address1} ${store.city} ${store.state} ${store.postalCode}`.toLowerCase().includes(query)).slice(0, 10);
  }, [allStores, storeQuery]);

  const eligibleSystems = allSystems.filter((system) => system.storeId === form.storeId && system.categoryId === form.categoryId);
  const eligibleSystemIds = new Set(eligibleSystems.map((system) => system.id));
  const eligibleAssets = allAssets.filter((asset) => eligibleSystemIds.has(asset.storeSystemId));
  const targetOptions = form.targetType === "system" ? eligibleSystems : eligibleAssets;
  const matchingTargets = targetOptions.filter((target) => {
    const query = targetQuery.trim().toLowerCase();
    if (!query) return true;
    if ("assetTag" in target) return `${target.assetTag} ${target.name} ${target.location} ${target.manufacturer} ${target.model}`.toLowerCase().includes(query);
    return `${target.code} ${target.name} ${target.location}`.toLowerCase().includes(query);
  });

  function patchForm(values: Partial<FormState>) {
    setForm((current) => ({ ...current, ...values }));
    setMessage("");
  }

  function chooseStore(storeId: string) {
    patchForm({ storeId, categoryId: "", targetId: "" });
    setStoreQuery("");
    setTargetQuery("");
  }

  function chooseCategory(categoryId: string) {
    patchForm({ categoryId, targetId: "" });
    setTargetQuery("");
  }

  function chooseTargetType(targetType: TargetType) {
    patchForm({ targetType, targetId: "" });
    setTargetQuery("");
  }

  function chooseTarget(targetId: string) {
    const target = form.targetType === "system" ? allSystems.find((item) => item.id === targetId) : allAssets.find((item) => item.id === targetId);
    setForm((current) => ({
      ...current,
      targetId,
      name: current.name || (target ? `${target.name} preventive maintenance` : ""),
    }));
    setMessage("");
  }

  function validateScope() {
    if (!form.storeId) return "Choose the store where this plan will run.";
    if (!form.categoryId) return "Choose the maintenance category for reporting and routing.";
    if (!form.targetId) return `Choose the ${form.targetType} this plan will maintain.`;
    return "";
  }

  function validatePlan() {
    if (form.name.trim().length < 3) return "Enter a clear plan name.";
    if (form.description.trim().length < 10) return "Describe the preventive work and expected outcome.";
    if (!form.startAt) return "Choose the first due date.";
    if (!form.requiredDocument.trim()) return "Specify the document or evidence required for verification.";
    return "";
  }

  function continueFlow() {
    const issue = step === 0 ? validateScope() : validatePlan();
    if (issue) { setMessage(issue); return; }
    setStep((current) => Math.min(2, current + 1));
    setMessage("");
  }

  async function createPlan() {
    const issue = validateScope() || validatePlan();
    if (issue) { setMessage(issue); return; }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "pm-plans",
          data: {
            name: form.name.trim(),
            description: form.description.trim(),
            categoryId: form.categoryId,
            targetType: form.targetType,
            targetId: form.targetId,
            storeId: form.storeId,
            frequency: form.frequency,
            startAt: `${form.startAt}T12:00:00.000Z`,
            vendorId: form.vendorId || undefined,
            requiredDocument: form.requiredDocument.trim(),
          },
        }),
      });
      const result = await response.json() as { ok?: boolean; id?: string; occurrenceId?: string; error?: string };
      if (!response.ok || !result.ok || !result.id || !result.occurrenceId) throw new Error(result.error || "Unable to create PM plan");
      setCreated({ id: result.id, occurrenceId: result.occurrenceId });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create PM plan");
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreator() {
    setForm({
      storeId: "",
      categoryId: "",
      targetType: "system",
      targetId: "",
      name: "",
      description: "",
      frequency: "quarterly",
      startAt: defaultStartDate(),
      vendorId: "",
      requiredDocument: documentPresets[1],
    });
    setCreated(null);
    setStep(0);
    setStoreQuery("");
    setTargetQuery("");
    setMessage("");
  }

  if (created) {
    return (
      <AppShell>
        <main className="pf-page pm-create-page pm-create-success-page">
          <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Preventive maintenance", href: "/pm" }, { label: "Plan created" }]} />
          <section className="pm-create-success">
            <span className="pm-create-success-icon"><CheckCircle2 /></span>
            <PlatformBadge tone="good">Active plan created</PlatformBadge>
            <h1>{form.name}</h1>
            <p>The recurring plan and its first dated occurrence are saved. The PM register now has an accountable service window and a clear evidence requirement.</p>
            <div className="pm-create-success-summary">
              <span><small>Store</small><strong>Store {selectedStore?.code} - {selectedStore?.city}</strong></span>
              <span><small>Target</small><strong>{selectedTargetName}</strong></span>
              <span><small>First due</small><strong>{formatDate(form.startAt)}</strong></span>
              <span><small>Provider</small><strong>{selectedVendor?.name ?? "Maintenance team assigns later"}</strong></span>
            </div>
            <div className="pm-create-success-actions">
              <Link className="pf-primary-button" href="/pm">View PM schedule <ArrowRight /></Link>
              <button className="pf-secondary-button" type="button" onClick={resetCreator}>Create another plan</button>
            </div>
            <small className="pm-create-record-id">Plan {created.id} &middot; first occurrence {created.occurrenceId}</small>
          </section>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="pf-page pm-create-page">
        <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Preventive maintenance", href: "/pm" }, { label: "Create plan" }]} />
        <PlatformPageHeader eyebrow="Preventive maintenance setup" title="Create a PM plan" description="Define the exact store and equipment scope, recurring cadence, accountable provider and proof required before an occurrence counts as complete.">
          <Link className="pf-secondary-button" href="/pm"><ArrowLeft />Cancel</Link>
        </PlatformPageHeader>

        <div className="pm-create-stepper" aria-label="PM plan creation progress">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return <div className={index === step ? "active" : index < step ? "done" : ""} key={item.label}><span>{index < step ? <Check /> : <Icon />}</span><div><strong>{item.label}</strong><small>{item.description}</small></div></div>;
          })}
        </div>

        <div className="pm-create-layout">
          <form className="pm-create-workspace" onSubmit={(event) => { event.preventDefault(); if (step < 2) continueFlow(); else void createPlan(); }}>
            <header className="pm-create-workspace-header">
              <span>{step + 1}</span>
              <div><p>Step {step + 1} of {steps.length}</p><h2>{steps[step].label}</h2><small>{steps[step].description}</small></div>
            </header>

            {step === 0 && <div className="pm-create-body">
              <section className="pm-create-section">
                <header><Building2 /><div><h3>1. Select the store</h3><p>Search by store number, name, city or full address.</p></div>{selectedStore && <PlatformBadge tone="good">Store {selectedStore.code}</PlatformBadge>}</header>
                <label className="pm-create-search"><Search /><input value={storeQuery} onChange={(event) => setStoreQuery(event.target.value)} placeholder="Search store number or address" aria-label="Search stores" /></label>
                <div className="pm-create-store-grid">
                  {matchingStores.map((store) => <button className={form.storeId === store.id ? "selected" : ""} type="button" onClick={() => chooseStore(store.id)} aria-pressed={form.storeId === store.id} key={store.id}><span><strong>Store {store.code}</strong><small>{store.name}</small></span>{form.storeId === store.id && <CheckCircle2 />}<em><MapPin />{store.address1}, {store.city}, {store.state} {store.postalCode}</em></button>)}
                  {!matchingStores.length && <div className="pm-create-inline-empty"><Search /><span><strong>No matching stores</strong><small>Try a store number, city or street address.</small></span></div>}
                </div>
              </section>

              <section className={`pm-create-section ${!form.storeId ? "disabled" : ""}`}>
                <header><ClipboardCheck /><div><h3>2. Choose the reporting category</h3><p>The category controls portfolio rollups and available equipment.</p></div>{selectedCategory && <PlatformBadge tone="info">{selectedCategory.name}</PlatformBadge>}</header>
                <div className="pm-create-category-grid">
                  {platformData.categories.map((category) => {
                    const systems = allSystems.filter((system) => system.storeId === form.storeId && system.categoryId === category.id);
                    const systemIds = new Set(systems.map((system) => system.id));
                    const assetCount = allAssets.filter((asset) => systemIds.has(asset.storeSystemId)).length;
                    return <button className={form.categoryId === category.id ? "selected" : ""} type="button" disabled={!form.storeId} onClick={() => chooseCategory(category.id)} aria-pressed={form.categoryId === category.id} key={category.id}><i style={{ background: category.color }} /><span><strong>{category.name}</strong><small>{systems.length} systems &middot; {assetCount} assets</small></span>{form.categoryId === category.id && <Check />}</button>;
                  })}
                </div>
              </section>

              <section className={`pm-create-section ${!form.categoryId ? "disabled" : ""}`}>
                <header><Wrench /><div><h3>3. Set the maintained target</h3><p>Target the equipment group or one specific asset.</p></div>{form.targetId && <PlatformBadge tone="good">Target selected</PlatformBadge>}</header>
                <div className="pm-create-target-type">
                  <button className={form.targetType === "system" ? "selected" : ""} type="button" disabled={!form.categoryId} onClick={() => chooseTargetType("system")}><Wrench /><span><strong>System / equipment group</strong><small>One plan covers the selected functional group.</small></span>{form.targetType === "system" && <CheckCircle2 />}</button>
                  <button className={form.targetType === "asset" ? "selected" : ""} type="button" disabled={!form.categoryId} onClick={() => chooseTargetType("asset")}><ShieldCheck /><span><strong>Individual asset</strong><small>One plan follows a specific tagged asset.</small></span>{form.targetType === "asset" && <CheckCircle2 />}</button>
                </div>
                <label className="pm-create-search"><Search /><input value={targetQuery} onChange={(event) => setTargetQuery(event.target.value)} disabled={!form.categoryId} placeholder={`Search ${form.targetType === "system" ? "system name, code or location" : "asset name, tag, make or model"}`} aria-label="Search maintenance targets" /></label>
                <div className="pm-create-target-list">
                  {matchingTargets.map((target) => {
                    const isAsset = "assetTag" in target;
                    const parent = isAsset ? allSystems.find((system) => system.id === target.storeSystemId) : undefined;
                    return <button className={form.targetId === target.id ? "selected" : ""} type="button" onClick={() => chooseTarget(target.id)} aria-pressed={form.targetId === target.id} key={target.id}><span className="pm-create-target-mark">{isAsset ? <ShieldCheck /> : <Wrench />}</span><span><strong>{isAsset ? `${target.assetTag} - ${target.name}` : target.name}</strong><small>{isAsset ? `${parent?.name ?? "Equipment group"} · ${target.manufacturer} ${target.model}` : `${target.code} · ${target.location || "Location not specified"}`}</small></span>{form.targetId === target.id && <CheckCircle2 />}</button>;
                  })}
                  {form.categoryId && !matchingTargets.length && <div className="pm-create-inline-empty"><Wrench /><span><strong>No {form.targetType}s match this scope</strong><small>{targetOptions.length ? "Change the target search." : `This store has no ${form.targetType} records in ${selectedCategory?.name}. Add equipment before scheduling this plan.`}</small></span></div>}
                </div>
              </section>
            </div>}

            {step === 1 && <div className="pm-create-body">
              <section className="pm-create-section">
                <header><FileText /><div><h3>Plan definition</h3><p>Write the standing scope technicians and providers will receive.</p></div></header>
                <div className="pm-create-fields">
                  <label><span>Plan name <b>*</b></span><input value={form.name} onChange={(event) => patchForm({ name: event.target.value })} maxLength={160} placeholder="Quarterly walk-in cooler service" /></label>
                  <label className="wide"><span>Scope and expected outcome <b>*</b></span><textarea rows={5} value={form.description} onChange={(event) => patchForm({ description: event.target.value })} maxLength={1000} placeholder="Describe inspections, cleaning, readings, adjustments, operational tests and when deficiencies require follow-up work." /><small>{form.description.length}/1000 characters</small></label>
                </div>
              </section>

              <section className="pm-create-section">
                <header><CalendarClock /><div><h3>Cadence and first due date</h3><p>Each recurrence creates a dated occurrence with a retained service window.</p></div></header>
                <div className="pm-create-frequency-grid">
                  {frequencyOptions.map((option) => <button className={form.frequency === option.value ? "selected" : ""} type="button" onClick={() => patchForm({ frequency: option.value })} key={option.value}><span><strong>{option.label}</strong><small>{option.note}</small></span>{form.frequency === option.value && <CheckCircle2 />}</button>)}
                </div>
                <div className="pm-create-fields two-column">
                  <label><span>First due date <b>*</b></span><input type="date" min={PLATFORM_NOW.slice(0, 10)} value={form.startAt} onChange={(event) => patchForm({ startAt: event.target.value })} /><small>A 15-day early and 15-day late service window will be created.</small></label>
                  <label><span>Preferred provider <em>Optional</em></span><select value={form.vendorId} onChange={(event) => patchForm({ vendorId: event.target.value })}><option value="">Assign for each occurrence</option>{platformData.vendors.map((vendor) => <option value={vendor.id} key={vendor.id}>{vendor.name} - {vendor.trade}</option>)}</select><small>Leaving this open keeps dispatch flexible.</small></label>
                </div>
              </section>

              <section className="pm-create-section">
                <header><FileCheck2 /><div><h3>Completion evidence</h3><p>The occurrence cannot count as verified until this proof is returned and reviewed.</p></div></header>
                <div className="pm-create-document-presets">{documentPresets.map((preset) => <button className={form.requiredDocument === preset ? "selected" : ""} type="button" onClick={() => patchForm({ requiredDocument: preset })} key={preset}><FileText /><span>{preset}</span>{form.requiredDocument === preset && <Check />}</button>)}</div>
                <div className="pm-create-fields"><label className="wide"><span>Required document or evidence <b>*</b></span><input value={form.requiredDocument} onChange={(event) => patchForm({ requiredDocument: event.target.value })} maxLength={120} placeholder="Completed checklist, readings and service photos" /></label></div>
              </section>
            </div>}

            {step === 2 && <div className="pm-create-body">
              <div className="pm-create-review-hero"><FileCheck2 /><div><span>Ready to activate</span><h3>{form.name}</h3><p>Creating this plan also creates its first scheduled occurrence. Future completion still requires returned evidence and verification.</p></div></div>
              <div className="pm-create-review-grid">
                <section><header><h3>Location and target</h3><button type="button" onClick={() => setStep(0)}>Edit</button></header><dl><div><dt>Store</dt><dd>Store {selectedStore?.code} - {selectedStore?.name}</dd></div><div><dt>Category</dt><dd>{selectedCategory?.name}</dd></div><div><dt>Target type</dt><dd>{form.targetType === "system" ? "System / equipment group" : "Individual asset"}</dd></div><div><dt>Target</dt><dd>{selectedTargetName}</dd></div></dl></section>
                <section><header><h3>Recurring schedule</h3><button type="button" onClick={() => setStep(1)}>Edit</button></header><dl><div><dt>Frequency</dt><dd>{frequencyOptions.find((option) => option.value === form.frequency)?.label}</dd></div><div><dt>First due</dt><dd>{formatDate(form.startAt)}</dd></div><div><dt>Service window</dt><dd>15 days early / 15 days late</dd></div><div><dt>Provider</dt><dd>{selectedVendor?.name ?? "Assign for each occurrence"}</dd></div></dl></section>
                <section className="wide"><header><h3>Standing scope and verification</h3><button type="button" onClick={() => setStep(1)}>Edit</button></header><dl><div><dt>Work scope</dt><dd>{form.description}</dd></div><div><dt>Required proof</dt><dd>{form.requiredDocument}</dd></div></dl></section>
              </div>
              <div className="pm-create-review-note"><ShieldCheck /><div><strong>Verified completion stays evidence based.</strong><p>A provider or internal technician can perform the work, but the occurrence only enters verified compliance after the required document is returned and reviewed.</p></div></div>
            </div>}

            {message && <div className="pm-create-error" role="alert"><ShieldCheck />{message}</div>}
            <footer className="pm-create-footer"><div>{step > 0 && <button className="pf-secondary-button" type="button" onClick={() => { setStep((current) => Math.max(0, current - 1)); setMessage(""); }}><ArrowLeft />Back</button>}</div><button className="pf-primary-button" type="submit" disabled={submitting}>{step < 2 ? <>Continue <ArrowRight /></> : submitting ? "Creating plan..." : <>Create active plan <ArrowRight /></>}</button></footer>
          </form>

          <aside className="pm-create-summary">
            <header><span>Live plan summary</span><strong>{form.name || "New preventive maintenance plan"}</strong></header>
            <div><small>Scope</small><strong>{selectedStore ? `Store ${selectedStore.code} · ${selectedStore.city}` : "Choose a store"}</strong><span>{selectedCategory?.name ?? "Category not selected"}</span></div>
            <div><small>Maintained target</small><strong>{selectedTargetName}</strong><span>{form.targetType === "system" ? "System / equipment group" : "Tagged asset"}</span></div>
            <div className="pm-create-summary-pair"><span><small>Cadence</small><strong>{frequencyOptions.find((option) => option.value === form.frequency)?.label}</strong></span><span><small>First due</small><strong>{form.startAt ? formatDate(form.startAt) : "Not set"}</strong></span></div>
            <div><small>Accountable provider</small><strong>{selectedVendor?.shortName ?? "Assign later"}</strong><span>{selectedVendor?.trade ?? "Internal or external fulfillment remains available"}</span></div>
            <footer><FileCheck2 /><span><strong>{form.requiredDocument || "Proof not set"}</strong><small>Required before verified completion</small></span></footer>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
