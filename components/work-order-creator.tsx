"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardPlus,
  Clock3,
  MapPin,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "@/components/site-link";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { demoData } from "@/lib/demo/data";
import type { Asset, Component, Store, StoreSystem } from "@/lib/domain/types";

type FormState = {
  storeId: string;
  categoryId: string;
  systemId: string;
  assetId: string;
  componentId: string;
  title: string;
  description: string;
  location: string;
  problemCode: string;
  requestedBy: string;
  priority: "critical" | "high" | "routine" | "low";
  workType: "reactive" | "preventive" | "inspection" | "emergency" | "warranty" | "capital" | "internal";
  assignmentType: "internal" | "vendor" | "blended" | "unassigned";
  assignedToId: string;
  vendorId: string;
  dueAt: string;
  estimatedHours: string;
  safetyRisk: "none" | "low" | "moderate" | "high";
  accessInstructions: string;
  nteDollars: string;
};

const initialForm: FormState = {
  storeId: "",
  categoryId: "",
  systemId: "",
  assetId: "",
  componentId: "",
  title: "",
  description: "",
  location: "",
  problemCode: "",
  requestedBy: "",
  priority: "routine",
  workType: "reactive",
  assignmentType: "unassigned",
  assignedToId: "",
  vendorId: "",
  dueAt: "",
  estimatedHours: "2",
  safetyRisk: "low",
  accessInstructions: "",
  nteDollars: "0",
};

type RegistryRecord = { id: string; [key: string]: unknown };

export function WorkOrderCreator({ initialStoreId = "", initialSystemId = "", initialAssetId = "", initialComponentId = "" }: { initialStoreId?: string; initialSystemId?: string; initialAssetId?: string; initialComponentId?: string }) {
  const initialSystem = demoData.systems.find((item) => item.id === initialSystemId);
  const [form, setForm] = useState<FormState>({ ...initialForm, storeId: initialStoreId || initialSystem?.storeId || "", categoryId: initialSystem?.categoryId || "", systemId: initialSystemId, assetId: initialAssetId, componentId: initialComponentId });
  const [storeQuery, setStoreQuery] = useState("");
  const [submitting, setSubmitting] = useState<"draft" | "approved" | "">("");
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<{ id: string; number: string; status: "draft" | "approved" } | null>(null);
  const [createdStores, setCreatedStores] = useState<Store[]>([]);
  const [createdSystems, setCreatedSystems] = useState<StoreSystem[]>([]);
  const [createdAssets, setCreatedAssets] = useState<Asset[]>([]);
  const [createdComponents, setCreatedComponents] = useState<Component[]>([]);

  useEffect(() => {
    const entities = ["stores", "cost-centers", "assets", "components"] as const;
    Promise.all(entities.map((entity) => fetch(`/api/registry?entity=${entity}`).then(async (response) => await response.json() as { ok?: boolean; records?: RegistryRecord[] })))
      .then((results) => {
        const fetchedStores = (results[0].records ?? []) as unknown as Store[];
        const fetchedSystems = (results[1].records ?? []) as unknown as StoreSystem[];
        const fetchedAssets = (results[2].records ?? []) as unknown as Asset[];
        const fetchedComponents = (results[3].records ?? []) as unknown as Component[];
        if (results[0]?.ok) setCreatedStores(fetchedStores);
        if (results[1]?.ok) setCreatedSystems(fetchedSystems);
        if (results[2]?.ok) setCreatedAssets(fetchedAssets);
        if (results[3]?.ok) setCreatedComponents(fetchedComponents);
        const component = [...demoData.components, ...fetchedComponents].find((item) => item.id === initialComponentId);
        const asset = [...demoData.assets, ...fetchedAssets].find((item) => item.id === (initialAssetId || component?.assetId));
        const system = [...demoData.systems, ...fetchedSystems].find((item) => item.id === (initialSystemId || asset?.storeSystemId));
        if (system) setForm((current) => ({ ...current, storeId: current.storeId || system.storeId, categoryId: current.categoryId || system.categoryId, systemId: current.systemId || system.id, assetId: current.assetId || asset?.id || "" }));
      }).catch(() => undefined);
  }, [initialAssetId, initialComponentId, initialSystemId]);

  const allStores = useMemo(() => [...demoData.stores, ...createdStores.filter((item) => !demoData.stores.some((seeded) => seeded.id === item.id))], [createdStores]);
  const allSystems = useMemo(() => [...demoData.systems, ...createdSystems.filter((item) => !demoData.systems.some((seeded) => seeded.id === item.id))], [createdSystems]);
  const allAssets = useMemo(() => [...demoData.assets, ...createdAssets.filter((item) => !demoData.assets.some((seeded) => seeded.id === item.id))], [createdAssets]);
  const allComponents = useMemo(() => [...demoData.components, ...createdComponents.filter((item) => !demoData.components.some((seeded) => seeded.id === item.id))], [createdComponents]);

  const selectedStore = allStores.find((item) => item.id === form.storeId);
  const matchingStores = useMemo(() => {
    const query = storeQuery.trim().toLowerCase();
    if (!query) return allStores.slice(0, 8);
    return allStores.filter((store) => `${store.code} ${store.name} ${store.address1} ${store.city} ${store.state} ${store.postalCode}`.toLowerCase().includes(query)).slice(0, 10);
  }, [storeQuery, allStores]);
  const systems = allSystems.filter((item) => item.storeId === form.storeId && item.categoryId === form.categoryId);
  const assets = allAssets.filter((item) => item.storeSystemId === form.systemId);
  const components = allComponents.filter((item) => item.assetId === form.assetId);

  function patchForm(values: Partial<FormState>) {
    setForm((current) => ({ ...current, ...values }));
    setMessage("");
  }

  function chooseStore(storeId: string) {
    const store = allStores.find((item) => item.id === storeId);
    patchForm({ storeId, systemId: "", assetId: "", componentId: "", location: "" });
    setStoreQuery(store ? `Store ${store.code} · ${store.city}` : "");
  }

  function changeCategory(categoryId: string) {
    patchForm({ categoryId, systemId: "", assetId: "", componentId: "" });
  }

  function changeSystem(systemId: string) {
    patchForm({ systemId, assetId: "", componentId: "" });
  }

  function changeAsset(assetId: string) {
    patchForm({ assetId, componentId: "" });
  }

  async function submit(event: FormEvent, status: "draft" | "approved") {
    event.preventDefault();
    if (!form.storeId || !form.categoryId) {
      setMessage("Choose a store and service category. Equipment can remain deferred.");
      return;
    }
    setSubmitting(status);
    setMessage("");
    const technician = demoData.technicians.find((item) => item.id === form.assignedToId);
    const vendor = demoData.vendors.find((item) => item.id === form.vendorId);
    const assignedToName = form.assignmentType === "internal" ? technician?.name : form.assignmentType === "vendor" ? vendor?.name : form.assignmentType === "blended" ? [technician?.name, vendor?.shortName].filter(Boolean).join(" + ") : "";
    try {
      const response = await fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "work-orders",
          data: {
            ...form,
            status,
            assignedToName,
            nteCents: Math.round((Number(form.nteDollars) || 0) * 100),
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

  if (created) return <AppShell><div className="page"><Breadcrumbs items={[{ label: "Work Orders", href: "/work-orders" }, { label: "New work order" }]} /><div className="creation-success panel panel-pad"><span className="success-icon"><CheckCircle2 /></span><p className="eyebrow">{created.status === "draft" ? "Draft saved" : "Work order issued"}</p><h1>{created.number} is ready.</h1><p>{created.status === "draft" ? "The request is in the planning queue for scope review and assignment." : "The work order is now in the maintenance queue. Deferred equipment can be identified during triage or diagnosis."}</p><div className="brief-actions"><Link className="button primary" href={`/work-orders/${created.id}`}>Open work order <ChevronRight /></Link><Link className="button" href="/work-orders">Return to work orders</Link></div></div></div></AppShell>;

  return <AppShell><div className="page">
    <Breadcrumbs items={[{ label: "Maintenance", href: "/" }, { label: "Work Orders", href: "/work-orders" }, { label: "Create" }]} />
    <PageHeader eyebrow="Maintenance intake" title="Create a work order" description="Issue useful work now. Start with the store and trade; cost center, asset and component can stay deferred until maintenance identifies the equipment.">
      <Link className="button" href="/work-orders"><ArrowLeft />Cancel</Link>
    </PageHeader>

    <form className="work-order-create" onSubmit={(event) => submit(event, "approved")}>
      <div className="work-order-form-stack">
        <section className="panel maintenance-form-section">
          <div className="form-section-head"><span>1</span><div><h2>Store and problem</h2><p>Give the person receiving this work enough information to act without calling the store back.</p></div></div>
          <div className="form-section-body">
            <div className="admin-form">
              <label className="form-field wide"><span>Find store <b aria-hidden="true">*</b></span><div className="store-finder"><Search /><input value={storeQuery} onChange={(event) => { setStoreQuery(event.target.value); if (form.storeId) patchForm({ storeId: "", systemId: "", assetId: "", componentId: "" }); }} placeholder="Search store number, name, street address or city" /></div></label>
            </div>
            {!selectedStore && <div className="store-results" aria-label="Matching stores">{matchingStores.map((store) => <button type="button" key={store.id} onClick={() => chooseStore(store.id)}><StoreResult code={store.code} name={store.name} address={`${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`} manager={store.managerName} /></button>)}{!matchingStores.length && <div className="empty-state">No stores match that search.</div>}</div>}
            {selectedStore && <div className="selected-store"><MapPin /><div><strong>Store {selectedStore.code} · {selectedStore.city}</strong><span>{selectedStore.address1}, {selectedStore.city}, {selectedStore.state} {selectedStore.postalCode} · Manager: {selectedStore.managerName}</span></div><button type="button" className="button small" onClick={() => { patchForm({ storeId: "", systemId: "", assetId: "", componentId: "" }); setStoreQuery(""); }}>Change</button></div>}
            <div className="admin-form form-block-gap">
              <label className="form-field"><span>Requested by <b aria-hidden="true">*</b></span><input required value={form.requestedBy} onChange={(event) => patchForm({ requestedBy: event.target.value })} placeholder="Name or service desk" /></label>
              <label className="form-field"><span>Exact area / location</span><input value={form.location} onChange={(event) => patchForm({ location: event.target.value })} placeholder="Kitchen · oven line · left unit" /></label>
              <label className="form-field wide"><span>Short problem title <b aria-hidden="true">*</b></span><input required minLength={3} value={form.title} onChange={(event) => patchForm({ title: event.target.value })} placeholder="Combi oven will not heat above 250°F" /></label>
              <label className="form-field wide"><span>Problem description <b aria-hidden="true">*</b></span><textarea required minLength={5} value={form.description} onChange={(event) => patchForm({ description: event.target.value })} placeholder="What happened, when it started, operational impact, alarms or observations, and anything already attempted." /></label>
              <label className="form-field"><span>Priority</span><select value={form.priority} onChange={(event) => patchForm({ priority: event.target.value as FormState["priority"] })}><option value="critical">Critical · safety or operation stopped</option><option value="high">High · major degradation</option><option value="routine">Routine · normal response</option><option value="low">Low · convenience / cosmetic</option></select></label>
              <label className="form-field"><span>Work type</span><select value={form.workType} onChange={(event) => patchForm({ workType: event.target.value as FormState["workType"] })}><option value="reactive">Reactive repair</option><option value="emergency">Emergency</option><option value="preventive">Preventive maintenance</option><option value="inspection">Inspection</option><option value="warranty">Warranty</option><option value="capital">Capital work</option><option value="internal">Internal maintenance</option></select></label>
              <label className="form-field"><span>Safety risk</span><select value={form.safetyRisk} onChange={(event) => patchForm({ safetyRisk: event.target.value as FormState["safetyRisk"] })}><option value="none">None identified</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High · review before dispatch</option></select></label>
              <label className="form-field"><span>Problem code</span><input value={form.problemCode} onChange={(event) => patchForm({ problemCode: event.target.value })} placeholder="Optional · e.g. NO-HEAT" /></label>
            </div>
          </div>
        </section>

        <section className="panel maintenance-form-section">
          <div className="form-section-head"><span>2</span><div><h2>Equipment classification</h2><p>Progressive by design. Only the service category is required to issue the work order.</p></div></div>
          <div className="form-section-body">
            <div className="defer-callout"><Wrench /><div><strong>Diagnosis can happen after dispatch.</strong><p>Leave cost center, asset or component on “defer” when the requester does not know. The technician can classify it from the work order without changing the original request.</p></div></div>
            <div className="admin-form form-block-gap">
              <label className="form-field"><span>Service category <b aria-hidden="true">*</b></span><select required value={form.categoryId} onChange={(event) => changeCategory(event.target.value)}><option value="">Choose the responsible trade</option>{demoData.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="form-field"><span>Cost center / system</span><select value={form.systemId} disabled={!form.storeId || !form.categoryId} onChange={(event) => changeSystem(event.target.value)}><option value="">Defer until triage</option>{systems.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name} · {item.location}</option>)}</select><small>{form.systemId ? "Cost center selected" : "No cost center will be attached yet"}</small></label>
              <label className="form-field"><span>Asset</span><select value={form.assetId} disabled={!form.systemId} onChange={(event) => changeAsset(event.target.value)}><option value="">Defer until diagnosis</option>{assets.map((item) => <option key={item.id} value={item.id}>{item.assetTag} · {item.name} · {item.location}</option>)}</select><small>{form.assetId ? "Asset selected" : "No asset will be attached yet"}</small></label>
              <label className="form-field"><span>Component</span><select value={form.componentId} disabled={!form.assetId} onChange={(event) => patchForm({ componentId: event.target.value })}><option value="">Defer until repair or quote</option>{components.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.partNumber}</option>)}</select><small>{form.componentId ? "Component selected" : "No component will be attached yet"}</small></label>
            </div>
            <div className="classification-path" aria-label="Current classification depth"><span className={form.storeId ? "done" : "required"}>{selectedStore ? `Store ${selectedStore.code}` : "Store required"}</span><ChevronRight /><span className={form.categoryId ? "done" : "required"}>{demoData.categories.find((item) => item.id === form.categoryId)?.name ?? "Category required"}</span><ChevronRight /><span>{allSystems.find((item) => item.id === form.systemId)?.name ?? "Cost center deferred"}</span><ChevronRight /><span>{allAssets.find((item) => item.id === form.assetId)?.assetTag ?? "Asset deferred"}</span><ChevronRight /><span>{allComponents.find((item) => item.id === form.componentId)?.name ?? "Component deferred"}</span></div>
          </div>
        </section>

        <section className="panel maintenance-form-section">
          <div className="form-section-head"><span>3</span><div><h2>Assignment and schedule</h2><p>Send it to an internal technician, a vendor, both, or leave it for dispatch.</p></div></div>
          <div className="form-section-body admin-form">
            <label className="form-field"><span>Assignment</span><select value={form.assignmentType} onChange={(event) => patchForm({ assignmentType: event.target.value as FormState["assignmentType"], assignedToId: "", vendorId: "" })}><option value="unassigned">Unassigned · dispatch queue</option><option value="internal">Internal maintenance technician</option><option value="vendor">Service vendor</option><option value="blended">Internal lead + vendor</option></select></label>
            {(form.assignmentType === "internal" || form.assignmentType === "blended") && <label className="form-field"><span>Internal technician</span><select value={form.assignedToId} onChange={(event) => patchForm({ assignedToId: event.target.value })}><option value="">Assign during dispatch</option>{demoData.technicians.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.title} · {item.trades.join(" / ")}</option>)}</select></label>}
            {(form.assignmentType === "vendor" || form.assignmentType === "blended") && <label className="form-field"><span>Service vendor</span><select value={form.vendorId} onChange={(event) => patchForm({ vendorId: event.target.value })}><option value="">Choose during dispatch</option>{demoData.vendors.map((item) => <option key={item.id} value={item.id}>{item.shortName} · {item.trade}</option>)}</select></label>}
            <label className="form-field"><span>Target completion</span><input type="datetime-local" value={form.dueAt} onChange={(event) => patchForm({ dueAt: event.target.value })} /></label>
            <label className="form-field"><span>Estimated labor hours</span><input type="number" min="0" step="0.25" value={form.estimatedHours} onChange={(event) => patchForm({ estimatedHours: event.target.value })} /></label>
            <label className="form-field"><span>Not-to-exceed ($)</span><input type="number" min="0" step="1" value={form.nteDollars} onChange={(event) => patchForm({ nteDollars: event.target.value })} /></label>
            <label className="form-field wide"><span>Access, shutdown and safety instructions</span><textarea value={form.accessInstructions} onChange={(event) => patchForm({ accessInstructions: event.target.value })} placeholder="Store contact, key or roof access, LOTO, food protection, shutdown window, PPE, permit requirements…" /></label>
          </div>
        </section>
      </div>

      <aside className="create-rail">
        <section className="panel panel-pad create-summary"><p className="eyebrow">Work-order readiness</p><h2>{form.storeId && form.categoryId && form.title && form.description ? "Ready to issue" : "Complete the required scope"}</h2><ReadinessRow done={Boolean(form.storeId)} label="Store selected" /><ReadinessRow done={Boolean(form.categoryId)} label="Responsible trade selected" /><ReadinessRow done={form.title.length >= 3 && form.description.length >= 5} label="Problem scope documented" /><ReadinessRow done={Boolean(form.assignedToId || form.vendorId)} optional label="Maintenance owner assigned" /><ReadinessRow done={Boolean(form.assetId)} optional label="Asset identified" />
          <div className="create-principle"><ShieldAlert /><p><strong>Equipment is optional.</strong> An unidentified asset never blocks intake or dispatch.</p></div>
        </section>
        <section className="panel panel-pad create-actions"><button className="button primary" type="submit" disabled={Boolean(submitting)}>{submitting === "approved" ? "Issuing…" : <><ClipboardPlus />Issue work order</>}</button><button className="button" type="button" disabled={Boolean(submitting)} onClick={(event) => submit(event as unknown as FormEvent, "draft")}>{submitting === "draft" ? "Saving…" : "Save as draft"}</button><p>Issuing adds the work order to dispatch. Saving keeps it in planning.</p>{message && <div className="form-error"><AlertTriangle />{message}</div>}</section>
        <section className="callout"><strong><Clock3 /> What the technician receives</strong><p>Store and location, problem statement, priority, hazards, assignment, target, equipment depth, checklist, labor/parts capture, notes, photos and closeout controls.</p></section>
      </aside>
    </form>
  </div></AppShell>;
}

function StoreResult({ code, name, address, manager }: { code: string; name: string; address: string; manager: string }) {
  return <><span className="store-code">#{code}</span><span><strong>{name}</strong><small>{address} · {manager}</small></span><ChevronRight /></>;
}

function ReadinessRow({ done, label, optional = false }: { done: boolean; label: string; optional?: boolean }) {
  return <div className={`readiness-row ${done ? "done" : ""}`}><span>{done ? <CheckCircle2 /> : <span />}</span><strong>{label}</strong>{optional && <small>optional</small>}</div>;
}
