"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Factory,
  Layers3,
  LoaderCircle,
  PackageCheck,
  ShieldCheck,
  Store,
  UsersRound,
  Wrench,
} from "lucide-react";
import Link from "@/components/site-link";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, PageHeader, StatusBadge } from "@/components/ui";
import { demoData } from "@/lib/demo/data";

type CreatedCenter = { id: string; categoryId: string; name: string; code: string; location: string };
type CreatedAsset = { id: string; categoryId: string; name: string; assetTag: string; centerId: string };
type CenterDraft = { categoryId: string; enabled: boolean; name: string; location: string; strategy: string };

const centerDefaults: Record<string, Omit<CenterDraft, "categoryId" | "enabled">> = {
  refrigeration: { name: "Cold Beverage Refrigeration", location: "Back room and sales floor", strategy: "preventive" },
  hvac: { name: "Store HVAC", location: "Roof and sales floor", strategy: "preventive" },
  foodservice: { name: "Hot Food & Bakery", location: "Foodservice line", strategy: "preventive" },
  plumbing: { name: "Domestic Water & Plumbing", location: "Restrooms, back room and service areas", strategy: "preventive" },
  electrical: { name: "Electrical Distribution", location: "Electrical room and site", strategy: "condition_based" },
  fuel: { name: "Fuel & Forecourt", location: "Canopy, dispensers and tank field", strategy: "statutory" },
  building: { name: "Building & Site", location: "Interior, exterior and parking lot", strategy: "preventive" },
  "life-safety": { name: "Life Safety", location: "Entire store and site", strategy: "statutory" },
};

const templateCategories: Record<string, string[]> = {
  "full-store": ["refrigeration", "hvac", "foodservice", "plumbing", "electrical", "fuel", "building", "life-safety"],
  "shop-only": ["refrigeration", "hvac", "foodservice", "plumbing", "electrical", "building", "life-safety"],
  "fuel-only": ["electrical", "fuel", "building", "life-safety"],
  blank: [],
};

const assetDefaults: Record<string, { name: string; assetClass: string; suffix: string; location: string; criticality: "critical" | "high" | "standard"; replacement: number }> = {
  refrigeration: { name: "Condensing Unit CU-1", assetClass: "Condensing Unit", suffix: "CU1", location: "Exterior equipment pad", criticality: "critical", replacement: 18500 },
  hvac: { name: "Rooftop Unit RTU-1", assetClass: "Rooftop Unit", suffix: "RTU1", location: "Roof", criticality: "high", replacement: 22500 },
  foodservice: { name: "Combi Oven OVEN-1", assetClass: "Combi Oven", suffix: "OVEN1", location: "Foodservice line", criticality: "high", replacement: 14800 },
  plumbing: { name: "Water Heater WH-1", assetClass: "Water Heater", suffix: "WH1", location: "Back room", criticality: "high", replacement: 6200 },
  electrical: { name: "Main Distribution Panel MDP-1", assetClass: "Electrical Panel", suffix: "MDP1", location: "Electrical room", criticality: "critical", replacement: 12000 },
  fuel: { name: "Forecourt Controller FC-1", assetClass: "Fuel Controller", suffix: "FC1", location: "Manager office", criticality: "critical", replacement: 18000 },
  building: { name: "Automatic Entry Door AD-1", assetClass: "Automatic Door", suffix: "AD1", location: "Main entrance", criticality: "standard", replacement: 8500 },
  "life-safety": { name: "Fire Alarm Panel FACP-1", assetClass: "Fire Alarm Panel", suffix: "FACP1", location: "Back office", criticality: "critical", replacement: 11000 },
};

const componentDefaults: Record<string, Array<[string, string]>> = {
  refrigeration: [["Condenser Fan Motor", "MTR-CFM-1"], ["System Controller", "CTRL-REF-24V"]],
  hvac: [["Supply Fan Motor", "MTR-SFM-1"], ["Drive Belt Set", "BLT-RTU-SET"]],
  foodservice: [["Heating Element", "ELM-480-12"], ["Control Board", "PCB-OVN-22"]],
  plumbing: [["Ignition Module", "IGN-WH-24"], ["Temperature Sensor", "SNS-TEMP-10K"]],
  electrical: [["Main Breaker", "BRK-400A"], ["Surge Protector", "SPD-3P"]],
  fuel: [["Power Supply", "PSU-FC-24"], ["Communication Board", "PCB-FC-COMM"]],
  building: [["Door Operator", "OPR-ADA-1"], ["Safety Sensor", "SNS-DOOR-IR"]],
  "life-safety": [["Backup Battery", "BAT-12V-18AH"], ["Annunciator Module", "ANN-FACP-1"]],
};

function draftsFor(template: string): CenterDraft[] {
  return demoData.categories.map((category) => ({ categoryId: category.id, enabled: templateCategories[template].includes(category.id), ...centerDefaults[category.id] }));
}

export function StoreOnboardingWizard() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeProfile, setStoreProfile] = useState({ code: "", name: "", regionId: "region-central", address1: "", city: "", state: "PA", postalCode: "", phone: "", managerName: "", district: "", squareFeet: "4200" });
  const [template, setTemplate] = useState("full-store");
  const [centers, setCenters] = useState<CenterDraft[]>(draftsFor("full-store"));
  const [createdCenters, setCreatedCenters] = useState<CreatedCenter[]>([]);
  const [assetEnabled, setAssetEnabled] = useState<Record<string, boolean>>({});
  const [createdAssets, setCreatedAssets] = useState<CreatedAsset[]>([]);
  const [addComponents, setAddComponents] = useState(true);
  const [addPm, setAddPm] = useState(true);
  const [coverage, setCoverage] = useState("regional");
  const [counts, setCounts] = useState({ components: 0, pm: 0 });

  async function post(entity: string, data: Record<string, unknown>) {
    const response = await fetch("/api/registry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, data }) });
    const result = await response.json() as { ok?: boolean; id?: string; error?: string };
    if (!response.ok || !result.ok || !result.id) throw new Error(result.error || `Unable to create ${entity}`);
    return result.id;
  }

  async function createStore() {
    if (!storeProfile.code || !storeProfile.name || !storeProfile.address1 || !storeProfile.city || !storeProfile.postalCode) { setMessage("Complete the required store identity and address fields."); return; }
    setBusy(true); setMessage("");
    try {
      const id = await post("stores", { ...storeProfile, squareFeet: Number(storeProfile.squareFeet) || 0 });
      setStoreId(id); setStep(1);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create store"); }
    finally { setBusy(false); }
  }

  async function createCenters() {
    const selected = centers.filter((item) => item.enabled);
    if (!selected.length) { setMessage("Select at least one maintainable cost center, or use the blank template and add one manually."); return; }
    setBusy(true); setMessage("");
    try {
      const made = await Promise.all(selected.map(async (item) => {
        const short = item.categoryId.replace("life-safety", "safety").slice(0, 8).toUpperCase();
        const id = await post("cost-centers", { storeId, categoryId: item.categoryId, code: `${storeProfile.code}-${short}`, name: item.name, type: `${demoData.categories.find((category) => category.id === item.categoryId)?.name} operating system`, description: `Maintenance cost center created from the ${template.replaceAll("-", " ")} location blueprint.`, location: item.location, glCode: "6100", annualBudgetCents: 0, ownerName: storeProfile.managerName || "Store Manager", maintenanceStrategy: item.strategy });
        return { id, categoryId: item.categoryId, name: item.name, code: `${storeProfile.code}-${short}`, location: item.location };
      }));
      setCreatedCenters(made); setAssetEnabled(Object.fromEntries(made.map((item) => [item.id, true]))); setStep(2);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create cost centers"); }
    finally { setBusy(false); }
  }

  async function createAssets() {
    const selected = createdCenters.filter((item) => assetEnabled[item.id]);
    setBusy(true); setMessage("");
    try {
      const made = await Promise.all(selected.map(async (center) => {
        const preset = assetDefaults[center.categoryId];
        const id = await post("assets", { storeSystemId: center.id, assetClass: preset.assetClass, assetTag: `${storeProfile.code}-${preset.suffix}`, name: preset.name, manufacturer: "To verify", model: "To verify", serial: "Field verification required", location: preset.location, installedAt: "", replacementCostCents: preset.replacement * 100, criticality: preset.criticality });
        return { id, categoryId: center.categoryId, name: preset.name, assetTag: `${storeProfile.code}-${preset.suffix}`, centerId: center.id };
      }));
      setCreatedAssets(made); setStep(3);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create starter assets"); }
    finally { setBusy(false); }
  }

  async function activateStore() {
    setBusy(true); setMessage("");
    try {
      let componentCount = 0; let pmCount = 0;
      if (addComponents) {
        const componentJobs = createdAssets.flatMap((asset) => (componentDefaults[asset.categoryId] ?? []).map(([name, partNumber], index) => post("components", { assetId: asset.id, type: name, name, partNumber, serial: "", quantity: 1, unitCostCents: index ? 42000 : 18500, criticalSpare: index === 0, installedAt: "", warrantyEndsAt: "" })));
        await Promise.all(componentJobs); componentCount = componentJobs.length;
      }
      if (addPm) {
        const pmJobs = createdAssets.map((asset) => { const vendor = defaultVendor(asset.categoryId); return post("pm-plans", { name: `Quarterly ${asset.name} inspection`, description: "Initial store commissioning PM template with safety, inspection, cleaning, operational test and documentation steps.", categoryId: asset.categoryId, targetType: "asset", targetId: asset.id, storeId, frequency: asset.categoryId === "life-safety" ? "semiannual" : "quarterly", startAt: "2026-10-15T17:00:00.000Z", vendorId: vendor?.id, requiredDocument: "Completed checklist, readings and service evidence" }); });
        await Promise.all(pmJobs); pmCount = pmJobs.length;
      }
      setCounts({ components: componentCount, pm: pmCount }); setStep(4);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to finish store activation"); }
    finally { setBusy(false); }
  }

  const steps = ["Store profile", "Cost centers", "Assets", "Maintenance setup", "Ready"];
  return <AppShell><div className="page">
    <Breadcrumbs items={[{ label: "Stores", href: "/stores" }, { label: "Add store" }]} />
    <PageHeader eyebrow="Guided location commissioning" title="Add and activate a store" description="Create the location once, then build its maintainable hierarchy, starter equipment, components, PM and coverage in one connected workflow.">
      <Link className="button" href="/stores"><ArrowLeft />Exit setup</Link>
    </PageHeader>
    <div className="onboarding-progress" aria-label="Store setup progress">{steps.map((label, index) => <div className={`${index === step ? "active" : ""} ${index < step ? "complete" : ""}`} key={label}><span>{index < step ? <Check /> : index + 1}</span><strong>{label}</strong></div>)}</div>

    <div className="onboarding-layout">
      <section className="panel onboarding-main">
        {step === 0 && <><WizardHead icon={Store} title="Create the store record" description="This becomes the parent for every cost center, asset, request, work order, PM occurrence, part location and permission scope." /><div className="admin-form onboarding-fields"><Input label="Store number" required value={storeProfile.code} onChange={(value) => setStoreProfile({ ...storeProfile, code: value })} placeholder="156" /><Input label="Store name" required value={storeProfile.name} onChange={(value) => setStoreProfile({ ...storeProfile, name: value })} placeholder="Store 156 - New Market" /><label className="form-field"><span>Region</span><select value={storeProfile.regionId} onChange={(event) => setStoreProfile({ ...storeProfile, regionId: event.target.value })}>{demoData.regions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><Input label="District" value={storeProfile.district} onChange={(value) => setStoreProfile({ ...storeProfile, district: value })} placeholder="District 9" /><Input label="Street address" wide required value={storeProfile.address1} onChange={(value) => setStoreProfile({ ...storeProfile, address1: value })} placeholder="410 Market Street" /><Input label="City" required value={storeProfile.city} onChange={(value) => setStoreProfile({ ...storeProfile, city: value })} /><Input label="State" required value={storeProfile.state} onChange={(value) => setStoreProfile({ ...storeProfile, state: value.toUpperCase().slice(0, 2) })} /><Input label="ZIP code" required value={storeProfile.postalCode} onChange={(value) => setStoreProfile({ ...storeProfile, postalCode: value })} /><Input label="Phone" value={storeProfile.phone} onChange={(value) => setStoreProfile({ ...storeProfile, phone: value })} /><Input label="Store manager" value={storeProfile.managerName} onChange={(value) => setStoreProfile({ ...storeProfile, managerName: value })} /><Input label="Square feet" type="number" value={storeProfile.squareFeet} onChange={(value) => setStoreProfile({ ...storeProfile, squareFeet: value })} /></div><WizardActions busy={busy} primary="Create store & continue" onPrimary={createStore} /></>}

        {step === 1 && <><WizardHead icon={Layers3} title="Apply a maintainable store blueprint" description="Reuse a proven hierarchy, then change what is unique. This avoids rebuilding eight cost centers by hand for every new location." /><div className="blueprint-picker"><label><span>Starting blueprint</span><select value={template} onChange={(event) => { setTemplate(event.target.value); setCenters(draftsFor(event.target.value)); }}><option value="full-store">Full convenience store + fuel</option><option value="shop-only">Convenience store · no fuel</option><option value="fuel-only">Fuel kiosk / forecourt</option><option value="blank">Blank · build from scratch</option></select></label><div><Building2 /><strong>{centers.filter((item) => item.enabled).length} cost centers selected</strong><span>Names and physical locations remain editable.</span></div></div><div className="blueprint-grid">{centers.map((center, index) => { const category = demoData.categories.find((item) => item.id === center.categoryId)!; return <div className={`blueprint-row ${center.enabled ? "selected" : ""}`} key={center.categoryId}><label className="blueprint-check"><input type="checkbox" checked={center.enabled} onChange={(event) => setCenters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} /><span><Wrench /></span><strong>{category.name}</strong></label><input value={center.name} disabled={!center.enabled} onChange={(event) => setCenters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} aria-label={`${category.name} cost center name`} /><input value={center.location} disabled={!center.enabled} onChange={(event) => setCenters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, location: event.target.value } : item))} aria-label={`${category.name} physical location`} /></div>;})}</div><WizardActions busy={busy} primary={`Create ${centers.filter((item) => item.enabled).length} cost centers`} onPrimary={createCenters} /></>}

        {step === 2 && <><WizardHead icon={Factory} title="Register starter equipment" description="The blueprint proposes one critical or high-use asset per cost center. Keep it, skip it or add the rest later by scan, import or field walkdown." /><div className="asset-commission-list">{createdCenters.map((center) => { const preset = assetDefaults[center.categoryId]; return <label className={`asset-commission-row ${assetEnabled[center.id] ? "selected" : ""}`} key={center.id}><input type="checkbox" checked={assetEnabled[center.id] ?? true} onChange={(event) => setAssetEnabled({ ...assetEnabled, [center.id]: event.target.checked })} /><span className="asset-type"><Factory /></span><span><strong>{preset.name}</strong><small>{center.name} · {preset.location}</small></span><span className="mono">{storeProfile.code}-{preset.suffix}</span><StatusBadge tone={preset.criticality === "critical" ? "critical" : "warning"}>{preset.criticality}</StatusBadge></label>;})}</div><div className="callout"><strong>Field verification workflow</strong><p>Manufacturer, model, serial and exact install date are intentionally marked “To verify.” A technician can complete those fields from the asset record without delaying store activation.</p></div><WizardActions busy={busy} primary={`Create ${createdCenters.filter((item) => assetEnabled[item.id]).length} starter assets`} secondary="Skip assets for now" onSecondary={() => { setCreatedAssets([]); setStep(3); }} onPrimary={createAssets} /></>}

        {step === 3 && <><WizardHead icon={ShieldCheck} title="Connect the maintenance program" description="Finish the location with serviceable components, PM coverage and an accountable maintenance model." /><div className="activation-grid"><label className={`activation-card ${addComponents ? "selected" : ""}`}><input type="checkbox" checked={addComponents} onChange={(event) => setAddComponents(event.target.checked)} /><Cpu /><div><strong>Add standard components</strong><p>Create two serviceable parts under each starter asset, including part number and critical-spare flag.</p></div></label><label className={`activation-card ${addPm ? "selected" : ""}`}><input type="checkbox" checked={addPm} onChange={(event) => setAddPm(event.target.checked)} /><ClipboardCheck /><div><strong>Activate PM templates</strong><p>Create the first occurrence, service window, responsible trade and evidence requirement for each starter asset.</p></div></label></div><label className="coverage-picker"><UsersRound /><span><strong>Maintenance coverage model</strong><small>Controls default routing for requests from this store.</small></span><select value={coverage} onChange={(event) => setCoverage(event.target.value)}><option value="regional">Regional internal team · vendor escalation</option><option value="vendor">Primary trade vendors</option><option value="central">Central maintenance dispatch</option><option value="store">Store manager triage first</option></select></label><div className="readiness-review"><h3>Activation review</h3><div><span>Store</span><strong>#{storeProfile.code} · {storeProfile.city}</strong></div><div><span>Hierarchy</span><strong>{createdCenters.length} cost centers · {createdAssets.length} assets</strong></div><div><span>Components</span><strong>{addComponents ? `${createdAssets.length * 2} standard records` : "Add later"}</strong></div><div><span>PM</span><strong>{addPm ? `${createdAssets.length} initial plans` : "Add later"}</strong></div><div><span>Coverage</span><strong>{coverage.replaceAll("_", " ")}</strong></div></div><WizardActions busy={busy} primary="Activate store" onPrimary={activateStore} /></>}

        {step === 4 && <div className="activation-success"><span><CheckCircle2 /></span><p className="eyebrow">Store commissioned</p><h1>Store {storeProfile.code} is maintenance-ready.</h1><p>The location now has a connected equipment hierarchy and can receive requests, work orders, PM and costs at the right level from day one.</p><div className="activation-totals"><div><strong>1</strong><span>store</span></div><div><strong>{createdCenters.length}</strong><span>cost centers</span></div><div><strong>{createdAssets.length}</strong><span>assets</span></div><div><strong>{counts.components}</strong><span>components</span></div><div><strong>{counts.pm}</strong><span>PM plans</span></div></div><div className="brief-actions"><Link className="button primary" href={`/stores/${storeId}`}>Open store workspace <ArrowRight /></Link><Link className="button" href={`/work-orders/new?storeId=${storeId}`}>Create first work order</Link><Link className="button" href="/stores">Return to stores</Link></div></div>}
        {message && <div className="result-state danger"><strong>{message}</strong></div>}
      </section>

      <aside className="stack onboarding-aside"><section className="panel panel-pad"><p className="eyebrow">Hierarchy preview</p><div className="commission-tree"><div className={storeId ? "done" : "active"}><Store /><span><strong>Store {storeProfile.code || "—"}</strong><small>Location, responsibility and access scope</small></span></div><div className={createdCenters.length ? "done" : step === 1 ? "active" : ""}><Building2 /><span><strong>Cost centers</strong><small>{createdCenters.length || centers.filter((item) => item.enabled).length} operating systems</small></span></div><div className={createdAssets.length ? "done" : step === 2 ? "active" : ""}><Factory /><span><strong>Assets</strong><small>{createdAssets.length || "Field register"} tagged equipment</small></span></div><div className={counts.components ? "done" : step === 3 ? "active" : ""}><Cpu /><span><strong>Components & parts</strong><small>Serviceable children and spares</small></span></div><div className={counts.pm ? "done" : step === 3 ? "active" : ""}><ShieldCheck /><span><strong>PM & coverage</strong><small>Planned work and responsibility</small></span></div></div></section><section className="callout"><strong><PackageCheck /> Blueprint principle</strong><p>A regional operator can standardize common structure across 65 stores. An independent location can use a smaller template or start blank; both use the same hierarchy and work-order logic.</p></section></aside>
    </div>
  </div></AppShell>;
}

function defaultVendor(categoryId: string) {
  const terms: Record<string, string> = { refrigeration: "Refrigeration", hvac: "HVAC", foodservice: "food", plumbing: "Plumbing", electrical: "Electrical", fuel: "Fuel", building: "facilities", "life-safety": "safety" };
  return demoData.vendors.find((vendor) => `${vendor.name} ${vendor.trade}`.toLowerCase().includes(terms[categoryId].toLowerCase()));
}

function WizardHead({ icon: Icon, title, description }: { icon: typeof Store; title: string; description: string }) { return <header className="wizard-head"><span><Icon /></span><div><p className="eyebrow">Current step</p><h2>{title}</h2><p>{description}</p></div></header>; }
function WizardActions({ busy, primary, onPrimary, secondary, onSecondary }: { busy: boolean; primary: string; onPrimary: () => void; secondary?: string; onSecondary?: () => void }) { return <div className="wizard-actions">{secondary && <button className="button" type="button" onClick={onSecondary} disabled={busy}>{secondary}</button>}<button className="button primary" type="button" onClick={onPrimary} disabled={busy}>{busy ? <><LoaderCircle className="spin" />Working…</> : <>{primary}<ArrowRight /></>}</button></div>; }
function Input({ label, value, onChange, required = false, placeholder, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; type?: string; wide?: boolean }) { return <label className={`form-field ${wide ? "wide" : ""}`}><span>{label}{required ? " *" : ""}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} /></label>; }
