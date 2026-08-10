"use client";

import { type FormEvent, type ReactNode, useId, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  Gauge,
  Layers3,
  PackagePlus,
  Plus,
  ShieldCheck,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";

import type {
  Asset,
  AssetComponent,
  DemoDataset,
  InternalTeam,
  MaintenanceCategory,
  PmOccurrence,
  PreventiveMaintenancePlan,
  Region,
  Store,
  TaxonomyNode,
  Vendor,
  VendorContact,
} from "@/lib/cstore/types";

import styles from "./platform-setup-workflows.module.css";

export type PlatformSetupStore = Pick<
  Store,
  "id" | "storeNumber" | "name" | "normalizedAddress" | "activeCategoryIds" | "regionId"
>;
export type PlatformSetupCategory = Pick<
  MaintenanceCategory,
  "id" | "key" | "label" | "description" | "color" | "sortOrder" | "active"
>;
export type PlatformSetupRegion = Pick<Region, "id" | "name" | "code">;
export type PlatformSetupTaxonomyNode = Pick<
  TaxonomyNode,
  "id" | "categoryId" | "parentId" | "label" | "kind" | "sortOrder" | "active"
>;
export type PlatformSetupVendor = Pick<Vendor, "id" | "displayName" | "specialties" | "coverageRegionIds" | "status">;
export type PlatformSetupInternalTeam = Pick<InternalTeam, "id" | "name" | "description" | "categoryIds" | "regionIds">;
export type PlatformSetupAsset = Pick<
  Asset,
  | "id"
  | "storeId"
  | "categoryId"
  | "assetCode"
  | "name"
  | "locationDetail"
  | "status"
>;
export type PlatformSetupComponent = Pick<
  AssetComponent,
  "id" | "assetId" | "parentComponentId" | "componentCode" | "name" | "status"
>;

export interface VendorOnboardingValue {
  name: string;
  description: string;
  aliases: string[];
  categoryIds: string[];
  regionIds: string[];
  dispatchContact: {
    name: string;
    email: string;
    phone: string;
    preferredChannel: VendorContact["preferredChannel"];
  };
  afterHoursAvailable: boolean;
  portalEnabled: boolean;
  status: Extract<Vendor["status"], "approved" | "preferred">;
}

export interface VendorOnboardingFormProps {
  categories: PlatformSetupCategory[];
  regions: PlatformSetupRegion[];
  onSubmit: (value: VendorOnboardingValue) => void | Promise<void>;
  initialValue?: Partial<
    Omit<VendorOnboardingValue, "dispatchContact">
  > & { dispatchContact?: Partial<VendorOnboardingValue["dispatchContact"]> };
  isSubmitting?: boolean;
  className?: string;
}

export interface StoreServiceAreasValue {
  storeId: string;
  activeCategoryIds: string[];
}

export interface StoreServiceAreasFormProps {
  stores: PlatformSetupStore[];
  categories: PlatformSetupCategory[];
  onSubmit: (value: StoreServiceAreasValue) => void | Promise<void>;
  initialStoreId?: string;
  initialCategoryIds?: string[];
  isSubmitting?: boolean;
  className?: string;
}

export interface AssetSetupValue {
  storeId: string;
  categoryId: string;
  taxonomyNodeId: string;
  assetCode: string;
  name: string;
  assetType: string;
  locationDetail: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installedOn: string;
  expectedLifeYears: number;
  replacementEstimateMinor: number;
  supplierVendorId?: string;
  criticality: Asset["criticality"];
  warranty?: {
    provider: string;
    startsOn: string;
    endsOn: string;
    coverage: string;
    reference: string;
  };
}

export interface AssetSetupFormProps {
  stores: PlatformSetupStore[];
  categories: PlatformSetupCategory[];
  taxonomyNodes: PlatformSetupTaxonomyNode[];
  vendors: PlatformSetupVendor[];
  onSubmit: (value: AssetSetupValue) => void | Promise<void>;
  initialStoreId?: string;
  initialValue?: Partial<Omit<AssetSetupValue, "warranty">> & {
    warranty?: Partial<NonNullable<AssetSetupValue["warranty"]>>;
  };
  isSubmitting?: boolean;
  className?: string;
}

export interface ComponentSetupValue {
  assetId: string;
  parentComponentId?: string;
  componentCode: string;
  name: string;
  componentType: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installedOn?: string;
  status: AssetComponent["status"];
}

export interface ComponentSetupFormProps {
  assets: PlatformSetupAsset[];
  components: PlatformSetupComponent[];
  onSubmit: (value: ComponentSetupValue) => void | Promise<void>;
  initialAssetId?: string;
  initialValue?: Partial<ComponentSetupValue>;
  isSubmitting?: boolean;
  className?: string;
}

export interface PmPlanSetupValue {
  storeId: string;
  categoryId: string;
  assetId?: string;
  name: string;
  description: string;
  cadence: PreventiveMaintenancePlan["cadence"];
  nextDueAt: string;
  fulfillmentMode: Extract<PreventiveMaintenancePlan["fulfillmentMode"], "internal" | "external">;
  assignedPartyType: Extract<PreventiveMaintenancePlan["assignedPartyType"], "team" | "vendor">;
  assignedPartyId: string;
  requiredEvidence: PreventiveMaintenancePlan["requiredEvidence"];
}

export interface PmPlanFormProps {
  stores: PlatformSetupStore[];
  categories: PlatformSetupCategory[];
  assets: PlatformSetupAsset[];
  internalTeams: PlatformSetupInternalTeam[];
  vendors: PlatformSetupVendor[];
  onSubmit: (value: PmPlanSetupValue) => void | Promise<void>;
  initialStoreId?: string;
  initialValue?: Partial<PmPlanSetupValue>;
  isSubmitting?: boolean;
  className?: string;
}

export interface PmOccurrenceCompletionValue {
  occurrenceId: string;
  note?: string;
  checklistConfirmed: boolean;
  reading?: string;
  overrideReason?: string;
}

export interface PmOccurrenceWaiverValue {
  occurrenceId: string;
  reason: string;
}

export interface PmOccurrenceDetailProps {
  occurrence: PmOccurrence;
  plan: PreventiveMaintenancePlan;
  dataset: DemoDataset;
  onOpenLinkedWorkOrder?: (workOrderId: string) => void;
  onCreateWorkOrder?: (occurrenceId: string) => void | Promise<void>;
  onMarkComplete?: (value: PmOccurrenceCompletionValue) => void | Promise<void>;
  onWaive?: (value: PmOccurrenceWaiverValue) => void | Promise<void>;
  className?: string;
}

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function splitTerms(value: string) {
  return [...new Set(value.split(/[\n,]/).map((term) => term.trim()).filter(Boolean))];
}

function taxonomyLabel(
  node: PlatformSetupTaxonomyNode,
  byId: Map<string, PlatformSetupTaxonomyNode>,
) {
  const labels = [node.label];
  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId && !visited.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    visited.add(parent.id);
    labels.unshift(parent.label);
    parentId = parent.parentId;
  }
  return labels.join(" > ");
}

function moneyToMinor(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function words(value: string) {
  return value.replaceAll("_", " ");
}

function FormHeader({
  eyebrow,
  title,
  description,
  badge,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  icon: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className={styles.headerPill}>{icon}{badge}</span>
    </header>
  );
}

function FormFooter({
  error,
  summary,
  action,
  busyAction,
  submitting,
}: {
  error: string | null;
  summary: string;
  action: string;
  busyAction: string;
  submitting: boolean;
}) {
  return (
    <footer className={styles.footer}>
      <div className={styles.feedback} aria-live="polite">
        {error ? <p className={styles.error} role="alert"><CircleAlert />{error}</p> : <span>{summary}</span>}
      </div>
      <button className={styles.primaryButton} type="submit" disabled={submitting}>
        {submitting ? busyAction : action}<ArrowRight aria-hidden="true" />
      </button>
    </footer>
  );
}

export function VendorOnboardingForm({
  categories,
  regions,
  onSubmit,
  initialValue,
  isSubmitting: submittingFromParent = false,
  className,
}: VendorOnboardingFormProps) {
  const formId = useId();
  const [name, setName] = useState(initialValue?.name ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [aliases, setAliases] = useState(initialValue?.aliases?.join(", ") ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(initialValue?.categoryIds ?? []);
  const [regionIds, setRegionIds] = useState<string[]>(initialValue?.regionIds ?? []);
  const [contactName, setContactName] = useState(initialValue?.dispatchContact?.name ?? "");
  const [email, setEmail] = useState(initialValue?.dispatchContact?.email ?? "");
  const [phone, setPhone] = useState(initialValue?.dispatchContact?.phone ?? "");
  const [preferredChannel, setPreferredChannel] = useState<VendorContact["preferredChannel"]>(
    initialValue?.dispatchContact?.preferredChannel ?? "email",
  );
  const [afterHoursAvailable, setAfterHoursAvailable] = useState(initialValue?.afterHoursAvailable ?? false);
  const [portalEnabled, setPortalEnabled] = useState(initialValue?.portalEnabled ?? false);
  const [status, setStatus] = useState<VendorOnboardingValue["status"]>(initialValue?.status ?? "approved");
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = submittingFromParent || localSubmitting;

  function toggle(list: string[], id: string, setter: (next: string[]) => void) {
    setter(list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !description.trim()) return setError("Enter the vendor name and a plain-language description.");
    if (!categoryIds.length) return setError("Choose at least one service specialty.");
    if (!regionIds.length) return setError("Choose at least one service region.");
    if (!contactName.trim() || !email.trim() || !phone.trim()) return setError("Complete the dispatch contact so work can be issued.");
    try {
      setLocalSubmitting(true);
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        aliases: splitTerms(aliases),
        categoryIds,
        regionIds,
        dispatchContact: {
          name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          preferredChannel,
        },
        afterHoursAvailable,
        portalEnabled,
        status,
      });
    } catch {
      setError("The vendor was not saved. Nothing was changed; please try again.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form className={classes(styles.root, styles.surface, className)} onSubmit={handleSubmit} noValidate>
      <FormHeader eyebrow="Approved vendor network" title="Add a service partner" description="Capture enough information to find, select, and issue work to this vendor. A portal account remains optional." badge="Operator managed" icon={<Truck aria-hidden="true" />} />
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>1</span><div><h3>Vendor identity</h3><p>Use the name and terms your managers will search.</p></div></div>
          <div className={styles.fieldGrid}>
            <div className={classes(styles.field, styles.fieldWide)}><label htmlFor={`${formId}-name`}>Vendor name</label><input id={`${formId}-name`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Summit Refrigeration" required /></div>
            <div className={styles.field}><label htmlFor={`${formId}-relationship`}>Relationship</label><select id={`${formId}-relationship`} value={status} onChange={(event) => setStatus(event.target.value as VendorOnboardingValue["status"])}><option value="approved">Approved</option><option value="preferred">Preferred</option></select></div>
            <div className={classes(styles.field, styles.fieldFull)}><label htmlFor={`${formId}-description`}>What does this vendor do?</label><textarea id={`${formId}-description`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Commercial refrigeration and HVAC service for walk-ins, beer caves, and ice machines." required /></div>
            <div className={classes(styles.field, styles.fieldFull)}><label htmlFor={`${formId}-aliases`}>Search aliases <small>(optional)</small></label><input id={`${formId}-aliases`} value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="beer cave, walk-in cooler, refrigeration contractor" /><small>Separate terms with commas. These help managers search in everyday language.</small></div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>2</span><div><h3>Specialties and coverage</h3><p>Selections explain why the vendor appears for a store and service need.</p></div></div>
        <fieldset className={styles.fieldset}><legend>Service specialties</legend><div className={styles.optionGrid}>{categories.filter((category) => category.active !== false).sort((a, b) => a.sortOrder - b.sortOrder).map((category) => <label className={classes(styles.optionCard, categoryIds.includes(category.id) && styles.optionCardSelected)} key={category.id}><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => toggle(categoryIds, category.id, setCategoryIds)} /><i style={{ background: category.color }} /><span><strong>{category.label}</strong><small>{category.description}</small></span><Check aria-hidden="true" /></label>)}</div></fieldset>
          <fieldset className={styles.fieldset}><legend>Service regions</legend><div className={styles.compactOptions}>{regions.map((region) => <label className={classes(styles.compactOption, regionIds.includes(region.id) && styles.compactOptionSelected)} key={region.id}><input type="checkbox" checked={regionIds.includes(region.id)} onChange={() => toggle(regionIds, region.id, setRegionIds)} /><span><strong>{region.name}</strong><small>{region.code}</small></span><Check aria-hidden="true" /></label>)}</div></fieldset>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>3</span><div><h3>Dispatch contact and participation</h3><p>Work can be delivered without asking the vendor to adopt another system.</p></div></div>
          <div className={styles.fieldGrid}>
            <div className={classes(styles.field, styles.fieldWide)}><label htmlFor={`${formId}-contact`}>Dispatch contact</label><input id={`${formId}-contact`} value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Jordan Lee" /></div>
            <div className={styles.field}><label htmlFor={`${formId}-channel`}>Preferred channel</label><select id={`${formId}-channel`} value={preferredChannel} onChange={(event) => setPreferredChannel(event.target.value as VendorContact["preferredChannel"])}><option value="email">Email</option><option value="sms">Text message</option><option value="phone">Phone</option></select></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-email`}>Dispatch email</label><input id={`${formId}-email`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="dispatch@example.com" /></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-phone`}>Dispatch phone</label><input id={`${formId}-phone`} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(555) 555-0142" /></div>
          </div>
          <div className={styles.switchList}>
            <label htmlFor={`${formId}-after-hours`} aria-label="After-hours service available"><span><strong>After-hours service available</strong><small>Show this vendor for urgent off-hours decisions.</small></span><input id={`${formId}-after-hours`} type="checkbox" checked={afterHoursAvailable} onChange={(event) => setAfterHoursAvailable(event.target.checked)} /></label>
            <label htmlFor={`${formId}-portal`} aria-label="Optional vendor portal"><span><strong>Optional vendor portal</strong><small>Enable an account view for recurring office users. Secure links still work without it.</small></span><input id={`${formId}-portal`} type="checkbox" checked={portalEnabled} onChange={(event) => setPortalEnabled(event.target.checked)} /></label>
          </div>
        </section>
      </div>
      <FormFooter error={error} summary={`${categoryIds.length} specialties - ${regionIds.length} regions - ${status}`} action="Add approved vendor" busyAction="Adding vendor..." submitting={submitting} />
    </form>
  );
}

export function StoreServiceAreasForm({
  stores,
  categories,
  onSubmit,
  initialStoreId,
  initialCategoryIds,
  isSubmitting: submittingFromParent = false,
  className,
}: StoreServiceAreasFormProps) {
  const formId = useId();
  const firstStoreId = initialStoreId ?? stores[0]?.id ?? "";
  const firstStore = stores.find((store) => store.id === firstStoreId);
  const [storeId, setStoreId] = useState(firstStoreId);
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>(initialCategoryIds ?? firstStore?.activeCategoryIds ?? []);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = submittingFromParent || localSubmitting;
  const store = stores.find((record) => record.id === storeId);

  function changeStore(nextId: string) {
    setStoreId(nextId);
    setActiveCategoryIds(stores.find((record) => record.id === nextId)?.activeCategoryIds ?? []);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!storeId) return setError("Choose a store.");
    if (!activeCategoryIds.length) return setError("Keep at least one service area active so the store can request work.");
    try {
      setLocalSubmitting(true);
      await onSubmit({ storeId, activeCategoryIds });
    } catch {
      setError("The store service areas were not updated. Please try again.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form className={classes(styles.root, styles.surface, className)} onSubmit={handleSubmit} noValidate>
      <FormHeader eyebrow="Store setup" title="Choose active service areas" description="Use the same company language at every store while activating only the areas this location needs." badge="Company taxonomy" icon={<Layers3 aria-hidden="true" />} />
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.fieldGrid}>
            <div className={classes(styles.field, styles.fieldFull)}><label htmlFor={`${formId}-store`}>Store</label><select id={`${formId}-store`} value={storeId} onChange={(event) => changeStore(event.target.value)}><option value="">Choose a store</option>{stores.map((record) => <option value={record.id} key={record.id}>Store {record.storeNumber} - {record.name}</option>)}</select>{store ? <small>{store.normalizedAddress}</small> : null}</div>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>1</span><div><h3>Services available at this store</h3><p>Employees can report work against an active service area immediately. Equipment setup remains optional.</p></div></div>
              <div className={styles.optionGrid}>{categories.filter((category) => category.active !== false).sort((a, b) => a.sortOrder - b.sortOrder).map((category) => { const selected = activeCategoryIds.includes(category.id); return <label className={classes(styles.optionCard, selected && styles.optionCardSelected)} key={category.id}><input type="checkbox" checked={selected} onChange={() => setActiveCategoryIds((current) => selected ? current.filter((id) => id !== category.id) : [...current, category.id])} /><i style={{ background: category.color }} /><span><strong>{category.label}</strong><small>{category.description}</small></span><Check aria-hidden="true" /></label>; })}</div>
          <div className={styles.note}><ShieldCheck /><span><strong>Simple is valid</strong><small>A store can create a legitimate work order with its location and a problem. Activating a category does not require an asset inventory.</small></span></div>
        </section>
      </div>
      <FormFooter error={error} summary={`${activeCategoryIds.length} service areas will be active at ${store ? `Store ${store.storeNumber}` : "this store"}.`} action="Save service areas" busyAction="Saving..." submitting={submitting} />
    </form>
  );
}

export function AssetSetupForm({
  stores,
  categories,
  taxonomyNodes,
  vendors,
  onSubmit,
  initialStoreId,
  initialValue,
  isSubmitting: submittingFromParent = false,
  className,
}: AssetSetupFormProps) {
  const formId = useId();
  const [storeId, setStoreId] = useState(initialValue?.storeId ?? initialStoreId ?? stores[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(initialValue?.categoryId ?? "");
  const [taxonomyNodeId, setTaxonomyNodeId] = useState(initialValue?.taxonomyNodeId ?? "");
  const [assetCode, setAssetCode] = useState(initialValue?.assetCode ?? "");
  const [name, setName] = useState(initialValue?.name ?? "");
  const [assetType, setAssetType] = useState(initialValue?.assetType ?? "");
  const [locationDetail, setLocationDetail] = useState(initialValue?.locationDetail ?? "");
  const [manufacturer, setManufacturer] = useState(initialValue?.manufacturer ?? "");
  const [model, setModel] = useState(initialValue?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(initialValue?.serialNumber ?? "");
  const [installedOn, setInstalledOn] = useState(initialValue?.installedOn ?? "");
  const [expectedLifeYears, setExpectedLifeYears] = useState(String(initialValue?.expectedLifeYears ?? 12));
  const [replacementEstimate, setReplacementEstimate] = useState(initialValue?.replacementEstimateMinor !== undefined ? (initialValue.replacementEstimateMinor / 100).toFixed(2) : "");
  const [supplierVendorId, setSupplierVendorId] = useState(initialValue?.supplierVendorId ?? "");
  const [criticality, setCriticality] = useState<Asset["criticality"]>(initialValue?.criticality ?? "important");
  const [useWarranty, setUseWarranty] = useState(Boolean(initialValue?.warranty));
  const [warrantyProvider, setWarrantyProvider] = useState(initialValue?.warranty?.provider ?? "");
  const [warrantyStartsOn, setWarrantyStartsOn] = useState(initialValue?.warranty?.startsOn ?? "");
  const [warrantyEndsOn, setWarrantyEndsOn] = useState(initialValue?.warranty?.endsOn ?? "");
  const [warrantyCoverage, setWarrantyCoverage] = useState(initialValue?.warranty?.coverage ?? "");
  const [warrantyReference, setWarrantyReference] = useState(initialValue?.warranty?.reference ?? "");
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = submittingFromParent || localSubmitting;

  const selectedStore = stores.find((store) => store.id === storeId);
  const availableCategories = categories.filter((category) => category.active !== false && selectedStore?.activeCategoryIds.includes(category.id));
  const taxonomyById = useMemo(() => new Map(taxonomyNodes.map((node) => [node.id, node])), [taxonomyNodes]);
  const availableNodes = taxonomyNodes.filter((node) => node.active !== false && node.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  function resetClassification(nextStoreId: string, nextCategoryId = "") {
    setStoreId(nextStoreId);
    setCategoryId(nextCategoryId);
    setTaxonomyNodeId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const life = Number(expectedLifeYears);
    if (!storeId || !categoryId || !taxonomyNodeId) return setError("Choose the store, service area, and equipment type.");
    if (!assetCode.trim() || !name.trim() || !assetType.trim() || !locationDetail.trim()) return setError("Complete the asset identity and store location fields.");
    if (!manufacturer.trim() || !model.trim() || !serialNumber.trim()) return setError("Enter the manufacturer, model, and serial number.");
    if (!installedOn || !Number.isFinite(life) || life <= 0 || moneyToMinor(replacementEstimate) <= 0) return setError("Enter an install date, expected life, and replacement estimate.");
    if (useWarranty && (!warrantyProvider.trim() || !warrantyStartsOn || !warrantyEndsOn || !warrantyCoverage.trim())) return setError("Complete the warranty provider, dates, and coverage, or turn warranty tracking off.");
    try {
      setLocalSubmitting(true);
      await onSubmit({
        storeId,
        categoryId,
        taxonomyNodeId,
        assetCode: assetCode.trim(),
        name: name.trim(),
        assetType: assetType.trim(),
        locationDetail: locationDetail.trim(),
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        serialNumber: serialNumber.trim(),
        installedOn,
        expectedLifeYears: life,
        replacementEstimateMinor: moneyToMinor(replacementEstimate),
        ...(supplierVendorId ? { supplierVendorId } : {}),
        criticality,
        ...(useWarranty ? { warranty: { provider: warrantyProvider.trim(), startsOn: warrantyStartsOn, endsOn: warrantyEndsOn, coverage: warrantyCoverage.trim(), reference: warrantyReference.trim() } } : {}),
      });
    } catch {
      setError("The asset was not saved. Nothing was changed; please try again.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form className={classes(styles.root, styles.surface, className)} onSubmit={handleSubmit} noValidate>
      <FormHeader eyebrow="Equipment setup" title="Add an asset" description="Start with identity and location. Warranty, supplier, lifecycle, and component depth are useful additions, not a barrier to service." badge="Progressive detail" icon={<Gauge aria-hidden="true" />} />
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>1</span><div><h3>Place the equipment</h3><p>Keep operating scope separate from the company maintenance hierarchy.</p></div></div>
          <div className={styles.fieldGrid}>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-store`}>Store</label><select id={`${formId}-store`} value={storeId} onChange={(event) => resetClassification(event.target.value)}><option value="">Choose a store</option>{stores.map((store) => <option key={store.id} value={store.id}>Store {store.storeNumber} - {store.name}</option>)}</select></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-category`}>Service area</label><select id={`${formId}-category`} value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setTaxonomyNodeId(""); }} disabled={!storeId}><option value="">Choose a service area</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select><small>Only service areas active at this store appear.</small></div>
            <div className={classes(styles.field, styles.fieldFull)}><label htmlFor={`${formId}-taxonomy`}>Company equipment type</label><select id={`${formId}-taxonomy`} value={taxonomyNodeId} onChange={(event) => setTaxonomyNodeId(event.target.value)} disabled={!categoryId}><option value="">Choose a group or equipment type</option>{availableNodes.map((node) => <option value={node.id} key={node.id}>{taxonomyLabel(node, taxonomyById)}</option>)}</select><small>This uses company-standard naming while the asset name can remain store-friendly.</small></div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>2</span><div><h3>Identify the asset</h3><p>Use stable codes and physical details a technician can recognize onsite.</p></div></div>
          <div className={styles.fieldGrid}>
            <div className={styles.field}><label htmlFor={`${formId}-code`}>Asset code</label><input id={`${formId}-code`} value={assetCode} onChange={(event) => setAssetCode(event.target.value)} placeholder="REF-104-BC-01" /></div>
            <div className={classes(styles.field, styles.fieldWide)}><label htmlFor={`${formId}-asset-name`}>Asset name</label><input id={`${formId}-asset-name`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Beer Cave Refrigeration System" /></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-type`}>Asset type</label><input id={`${formId}-type`} value={assetType} onChange={(event) => setAssetType(event.target.value)} placeholder="Walk-in cooler system" /></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-location`}>Location in store</label><input id={`${formId}-location`} value={locationDetail} onChange={(event) => setLocationDetail(event.target.value)} placeholder="Rear sales floor - beer cave" /></div>
            <div className={styles.field}><label htmlFor={`${formId}-manufacturer`}>Manufacturer</label><input id={`${formId}-manufacturer`} value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor={`${formId}-model`}>Model</label><input id={`${formId}-model`} value={model} onChange={(event) => setModel(event.target.value)} /></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-serial`}>Serial number</label><input id={`${formId}-serial`} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} /></div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>3</span><div><h3>Lifecycle context</h3><p>These facts support transparent repair-versus-replacement review.</p></div></div>
          <div className={styles.fieldGrid}>
            <div className={styles.field}><label htmlFor={`${formId}-installed`}>Installed</label><input id={`${formId}-installed`} type="date" value={installedOn} onChange={(event) => setInstalledOn(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor={`${formId}-life`}>Expected life (years)</label><input id={`${formId}-life`} type="number" min="1" max="60" value={expectedLifeYears} onChange={(event) => setExpectedLifeYears(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor={`${formId}-replacement`}>Replacement estimate</label><div className={styles.moneyField}><span>$</span><input id={`${formId}-replacement`} type="number" min="0" step="0.01" value={replacementEstimate} onChange={(event) => setReplacementEstimate(event.target.value)} /></div></div>
            <div className={styles.field}><label htmlFor={`${formId}-criticality`}>Criticality</label><select id={`${formId}-criticality`} value={criticality} onChange={(event) => setCriticality(event.target.value as Asset["criticality"])}><option value="standard">Standard</option><option value="important">Important</option><option value="critical">Critical</option></select></div>
            <div className={classes(styles.field, styles.fieldFull)}><label htmlFor={`${formId}-supplier`}>Supplier or installer <small>(optional)</small></label><select id={`${formId}-supplier`} value={supplierVendorId} onChange={(event) => setSupplierVendorId(event.target.value)}><option value="">Not recorded</option>{vendors.map((vendor) => <option value={vendor.id} key={vendor.id}>{vendor.displayName}</option>)}</select></div>
          </div>
          <label className={styles.disclosureToggle} htmlFor={`${formId}-use-warranty`} aria-label="Track warranty information"><input id={`${formId}-use-warranty`} type="checkbox" checked={useWarranty} onChange={(event) => setUseWarranty(event.target.checked)} /><span><strong>Track warranty information</strong><small>Add only when the customer has reliable source information.</small></span></label>
          {useWarranty ? <div className={styles.disclosurePanel}><div className={styles.fieldGrid}>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-warranty-provider`}>Warranty provider</label><input id={`${formId}-warranty-provider`} value={warrantyProvider} onChange={(event) => setWarrantyProvider(event.target.value)} /></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-warranty-reference`}>Reference <small>(optional)</small></label><input id={`${formId}-warranty-reference`} value={warrantyReference} onChange={(event) => setWarrantyReference(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor={`${formId}-warranty-start`}>Starts</label><input id={`${formId}-warranty-start`} type="date" value={warrantyStartsOn} onChange={(event) => setWarrantyStartsOn(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor={`${formId}-warranty-end`}>Ends</label><input id={`${formId}-warranty-end`} type="date" value={warrantyEndsOn} onChange={(event) => setWarrantyEndsOn(event.target.value)} /></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-warranty-coverage`}>Coverage</label><input id={`${formId}-warranty-coverage`} value={warrantyCoverage} onChange={(event) => setWarrantyCoverage(event.target.value)} placeholder="Parts and compressor; labor excluded" /></div>
          </div></div> : null}
        </section>
      </div>
      <FormFooter error={error} summary="No downtime is inferred. Lifecycle analysis will use only recorded age, work, cost, warranty, and PM facts." action="Add asset" busyAction="Adding asset..." submitting={submitting} />
    </form>
  );
}

export function ComponentSetupForm({
  assets,
  components,
  onSubmit,
  initialAssetId,
  initialValue,
  isSubmitting: submittingFromParent = false,
  className,
}: ComponentSetupFormProps) {
  const formId = useId();
  const [assetId, setAssetId] = useState(initialValue?.assetId ?? initialAssetId ?? assets[0]?.id ?? "");
  const [parentComponentId, setParentComponentId] = useState(initialValue?.parentComponentId ?? "");
  const [componentCode, setComponentCode] = useState(initialValue?.componentCode ?? "");
  const [name, setName] = useState(initialValue?.name ?? "");
  const [componentType, setComponentType] = useState(initialValue?.componentType ?? "");
  const [manufacturer, setManufacturer] = useState(initialValue?.manufacturer ?? "");
  const [model, setModel] = useState(initialValue?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(initialValue?.serialNumber ?? "");
  const [installedOn, setInstalledOn] = useState(initialValue?.installedOn ?? "");
  const [status, setStatus] = useState<AssetComponent["status"]>(initialValue?.status ?? "active");
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = submittingFromParent || localSubmitting;
  const selectedAsset = assets.find((asset) => asset.id === assetId);
  const parentOptions = components.filter((component) => component.assetId === assetId && component.status !== "replaced");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!assetId) return setError("Choose the parent asset.");
    if (!componentCode.trim() || !name.trim() || !componentType.trim()) return setError("Enter the component code, name, and type.");
    try {
      setLocalSubmitting(true);
      await onSubmit({
        assetId,
        ...(parentComponentId ? { parentComponentId } : {}),
        componentCode: componentCode.trim(),
        name: name.trim(),
        componentType: componentType.trim(),
        ...(manufacturer.trim() ? { manufacturer: manufacturer.trim() } : {}),
        ...(model.trim() ? { model: model.trim() } : {}),
        ...(serialNumber.trim() ? { serialNumber: serialNumber.trim() } : {}),
        ...(installedOn ? { installedOn } : {}),
        status,
      });
    } catch {
      setError("The component was not saved. Please try again.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form className={classes(styles.root, styles.surface, className)} onSubmit={handleSubmit} noValidate>
      <FormHeader eyebrow="Equipment depth" title="Add a component" description="Track serviceable subassemblies only where the extra detail improves maintenance history." badge="Optional depth" icon={<PackagePlus aria-hidden="true" />} />
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.fieldGrid}>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-asset`}>Asset</label><select id={`${formId}-asset`} value={assetId} onChange={(event) => { setAssetId(event.target.value); setParentComponentId(""); }}><option value="">Choose an asset</option>{assets.filter((asset) => asset.status !== "retired").map((asset) => <option value={asset.id} key={asset.id}>{asset.assetCode} - {asset.name}</option>)}</select>{selectedAsset ? <small>{selectedAsset.locationDetail}</small> : null}</div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-parent`}>Parent component <small>(optional)</small></label><select id={`${formId}-parent`} value={parentComponentId} onChange={(event) => setParentComponentId(event.target.value)} disabled={!assetId}><option value="">Attach directly to asset</option>{parentOptions.map((component) => <option value={component.id} key={component.id}>{component.componentCode} - {component.name}</option>)}</select></div>
            <div className={styles.field}><label htmlFor={`${formId}-code`}>Component code</label><input id={`${formId}-code`} value={componentCode} onChange={(event) => setComponentCode(event.target.value)} placeholder="BC-01-COMP" /></div>
            <div className={classes(styles.field, styles.fieldWide)}><label htmlFor={`${formId}-name`}>Component name</label><input id={`${formId}-name`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Compressor assembly" /></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-type`}>Component type</label><input id={`${formId}-type`} value={componentType} onChange={(event) => setComponentType(event.target.value)} placeholder="Compressor" /></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-status`}>Status</label><select id={`${formId}-status`} value={status} onChange={(event) => setStatus(event.target.value as AssetComponent["status"])}><option value="active">Active</option><option value="monitor">Monitor</option><option value="replaced">Replaced</option></select></div>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>2</span><div><h3>Manufacturer details</h3><p>These fields are optional when the component plate is unavailable.</p></div></div>
          <div className={styles.fieldGrid}>
            <div className={styles.field}><label htmlFor={`${formId}-manufacturer`}>Manufacturer</label><input id={`${formId}-manufacturer`} value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor={`${formId}-model`}>Model</label><input id={`${formId}-model`} value={model} onChange={(event) => setModel(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor={`${formId}-serial`}>Serial number</label><input id={`${formId}-serial`} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor={`${formId}-installed`}>Installed <small>(optional)</small></label><input id={`${formId}-installed`} type="date" value={installedOn} onChange={(event) => setInstalledOn(event.target.value)} /></div>
          </div>
        </section>
      </div>
      <FormFooter error={error} summary="Components inherit store and service-area context from their asset." action="Add component" busyAction="Adding component..." submitting={submitting} />
    </form>
  );
}

export function PmPlanForm({
  stores,
  categories,
  assets,
  internalTeams,
  vendors,
  onSubmit,
  initialStoreId,
  initialValue,
  isSubmitting: submittingFromParent = false,
  className,
}: PmPlanFormProps) {
  const formId = useId();
  const [storeId, setStoreId] = useState(initialValue?.storeId ?? initialStoreId ?? stores[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(initialValue?.categoryId ?? "");
  const [assetId, setAssetId] = useState(initialValue?.assetId ?? "");
  const [name, setName] = useState(initialValue?.name ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [cadence, setCadence] = useState<PreventiveMaintenancePlan["cadence"]>(initialValue?.cadence ?? "quarterly");
  const [nextDueAt, setNextDueAt] = useState(initialValue?.nextDueAt?.slice(0, 10) ?? "");
  const initialPartyType = initialValue?.assignedPartyType ?? "vendor";
  const [assignedPartyType, setAssignedPartyType] = useState<PmPlanSetupValue["assignedPartyType"]>(initialPartyType);
  const [assignedPartyId, setAssignedPartyId] = useState(initialValue?.assignedPartyId ?? "");
  const [requiredEvidence, setRequiredEvidence] = useState<PreventiveMaintenancePlan["requiredEvidence"]>(initialValue?.requiredEvidence ?? ["visit", "checklist"]);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = submittingFromParent || localSubmitting;
  const store = stores.find((record) => record.id === storeId);
  const availableCategories = categories.filter((category) => category.active !== false && store?.activeCategoryIds.includes(category.id));
  const availableAssets = assets.filter((asset) => asset.storeId === storeId && asset.categoryId === categoryId && asset.status !== "retired");
  const assignees = assignedPartyType === "team"
    ? internalTeams.filter((team) => team.categoryIds.includes(categoryId) && (!store?.regionId || team.regionIds.includes(store.regionId)))
    : vendors.filter((vendor) => vendor.status !== "inactive" && vendor.specialties.some((specialty) => specialty.categoryId === categoryId) && (!store?.regionId || vendor.coverageRegionIds.includes(store.regionId)));
  const evidenceOptions: Array<{ value: PreventiveMaintenancePlan["requiredEvidence"][number]; label: string; description: string }> = [
    { value: "visit", label: "Observed visit", description: "Check-in and checkout record" },
    { value: "checklist", label: "Checklist", description: "Required service steps" },
    { value: "photo", label: "Photo", description: "Before, after, or condition evidence" },
    { value: "reading", label: "Reading", description: "Temperature, pressure, or measured result" },
  ];

  function changePartyType(next: PmPlanSetupValue["assignedPartyType"]) {
    setAssignedPartyType(next);
    setAssignedPartyId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!storeId || !categoryId) return setError("Choose the store and service area.");
    if (!name.trim() || !description.trim() || !nextDueAt) return setError("Enter the plan name, service description, and next due date.");
    if (!assignedPartyId) return setError("Choose the internal team or outside vendor responsible for this plan.");
    if (!requiredEvidence.length) return setError("Choose at least one completion-evidence requirement.");
    try {
      setLocalSubmitting(true);
      await onSubmit({
        storeId,
        categoryId,
        ...(assetId ? { assetId } : {}),
        name: name.trim(),
        description: description.trim(),
        cadence,
        nextDueAt: new Date(`${nextDueAt}T12:00:00`).toISOString(),
        fulfillmentMode: assignedPartyType === "team" ? "internal" : "external",
        assignedPartyType,
        assignedPartyId,
        requiredEvidence,
      });
    } catch {
      setError("The preventive-maintenance plan was not saved. Please try again.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form className={classes(styles.root, styles.surface, className)} onSubmit={handleSubmit} noValidate>
      <FormHeader eyebrow="Preventive maintenance" title="Create a PM plan" description="Define what is due, who owns it, and what completion evidence is useful. Generated work follows the same work-order lifecycle as reactive service." badge="Same work lifecycle" icon={<CalendarCheck aria-hidden="true" />} />
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>1</span><div><h3>What does this plan cover?</h3><p>An asset is optional; store- or category-level preventive work remains valid.</p></div></div>
          <div className={styles.fieldGrid}>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-store`}>Store</label><select id={`${formId}-store`} value={storeId} onChange={(event) => { setStoreId(event.target.value); setCategoryId(""); setAssetId(""); }}><option value="">Choose a store</option>{stores.map((record) => <option value={record.id} key={record.id}>Store {record.storeNumber} - {record.name}</option>)}</select></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-category`}>Service area</label><select id={`${formId}-category`} value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setAssetId(""); }} disabled={!storeId}><option value="">Choose a service area</option>{availableCategories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}</select></div>
            <div className={classes(styles.field, styles.fieldFull)}><label htmlFor={`${formId}-asset`}>Asset <small>(optional)</small></label><select id={`${formId}-asset`} value={assetId} onChange={(event) => setAssetId(event.target.value)} disabled={!categoryId}><option value="">Apply at store/category level</option>{availableAssets.map((asset) => <option value={asset.id} key={asset.id}>{asset.assetCode} - {asset.name}</option>)}</select></div>
            <div className={classes(styles.field, styles.fieldHalf)}><label htmlFor={`${formId}-name`}>Plan name</label><input id={`${formId}-name`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Quarterly RTU preventive service" /></div>
            <div className={styles.field}><label htmlFor={`${formId}-cadence`}>Cadence</label><select id={`${formId}-cadence`} value={cadence} onChange={(event) => setCadence(event.target.value as PreventiveMaintenancePlan["cadence"])}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="semiannual">Semiannual</option><option value="annual">Annual</option></select></div>
            <div className={styles.field}><label htmlFor={`${formId}-due`}>Next due</label><input id={`${formId}-due`} type="date" value={nextDueAt} onChange={(event) => setNextDueAt(event.target.value)} /></div>
            <div className={classes(styles.field, styles.fieldFull)}><label htmlFor={`${formId}-description`}>Required service</label><textarea id={`${formId}-description`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Inspect filters, belts, electrical connections, drains, temperatures, and document exceptions." /></div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>2</span><div><h3>Who normally handles it?</h3><p>The assignee can be changed on the generated work order without losing PM history.</p></div></div>
          <div className={styles.choiceRow}>
            <label className={classes(styles.choiceCard, assignedPartyType === "team" && styles.choiceCardSelected)}><input type="radio" name={`${formId}-party-type`} checked={assignedPartyType === "team"} onChange={() => changePartyType("team")} /><UserRound /><span><strong>Internal maintenance</strong><small>Send occurrences to a company team.</small></span></label>
            <label className={classes(styles.choiceCard, assignedPartyType === "vendor" && styles.choiceCardSelected)}><input type="radio" name={`${formId}-party-type`} checked={assignedPartyType === "vendor"} onChange={() => changePartyType("vendor")} /><Truck /><span><strong>Outside vendor</strong><small>Issue service through the approved vendor network.</small></span></label>
          </div>
          <div className={styles.field}><label htmlFor={`${formId}-assignee`}>{assignedPartyType === "team" ? "Internal team" : "Approved vendor"}</label><select id={`${formId}-assignee`} value={assignedPartyId} onChange={(event) => setAssignedPartyId(event.target.value)}><option value="">Choose {assignedPartyType === "team" ? "a team" : "a vendor"}</option>{assignees.map((party) => <option value={party.id} key={party.id}>{"displayName" in party ? party.displayName : party.name}</option>)}</select></div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span className={styles.step}>3</span><div><h3>Completion evidence</h3><p>Requirements should be useful and proportional, not burdensome by default.</p></div></div>
          <div className={styles.compactOptions}>{evidenceOptions.map((option) => { const selected = requiredEvidence.includes(option.value); return <label className={classes(styles.compactOption, selected && styles.compactOptionSelected)} key={option.value}><input type="checkbox" checked={selected} onChange={() => setRequiredEvidence((current) => selected ? current.filter((value) => value !== option.value) : [...current, option.value])} /><span><strong>{option.label}</strong><small>{option.description}</small></span><Check /></label>; })}</div>
        </section>
      </div>
      <FormFooter error={error} summary={`${cadence} cadence - ${requiredEvidence.length} evidence requirements - ${assignedPartyType === "team" ? "internal" : "outside vendor"}`} action="Create PM plan" busyAction="Creating plan..." submitting={submitting} />
    </form>
  );
}

export function PmOccurrenceDetail({
  occurrence,
  plan,
  dataset,
  onOpenLinkedWorkOrder,
  onCreateWorkOrder,
  onMarkComplete,
  onWaive,
  className,
}: PmOccurrenceDetailProps) {
  const [action, setAction] = useState<"complete" | "waive" | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [checklistConfirmed, setChecklistConfirmed] = useState(false);
  const [reading, setReading] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const store = dataset.stores.find((record) => record.id === occurrence.storeId);
  const category = dataset.categories.find((record) => record.id === plan.categoryId);
  const asset = plan.assetId ? dataset.assets.find((record) => record.id === plan.assetId) : undefined;
  const work = occurrence.workOrderId ? dataset.workOrders.find((record) => record.id === occurrence.workOrderId) : undefined;
  const visits = work ? dataset.visits.filter((visit) => visit.workOrderId === work.id) : [];
  const visitIds = new Set(visits.map((visit) => visit.id));
  const evidenceDocuments = work ? dataset.documents.filter((document) => document.workOrderId === work.id || (document.visitId && visitIds.has(document.visitId))) : [];
  const hasVisitEvidence = visits.some((visit) => Boolean(visit.checkedOutAt));
  const hasPhotoEvidence = evidenceDocuments.some((document) => document.kind === "before_photo" || document.kind === "after_photo" || document.mediaType.startsWith("image/"));
  const assignee = plan.assignedPartyType === "vendor"
    ? dataset.vendors.find((record) => record.id === plan.assignedPartyId)?.displayName
    : plan.assignedPartyType === "team"
      ? dataset.teams.find((record) => record.id === plan.assignedPartyId)?.name
      : dataset.people.find((record) => record.id === plan.assignedPartyId)?.displayName;
  const terminal = occurrence.status === "completed" || occurrence.status === "skipped";

  async function createWork() {
    if (!onCreateWorkOrder) return;
    setError(null);
    try {
      setBusy(true);
      await onCreateWorkOrder(occurrence.id);
    } catch {
      setError("The work order was not created. The PM occurrence is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function submitComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onMarkComplete) return;
    setError(null);
    const missingRequirements = plan.requiredEvidence.filter((requirement) =>
      requirement === "visit"
        ? !hasVisitEvidence
        : requirement === "photo"
          ? !hasPhotoEvidence
          : requirement === "checklist"
            ? !checklistConfirmed
            : !reading.trim(),
    );
    if (missingRequirements.length && overrideReason.trim().length < 8) {
      setError(`Missing ${missingRequirements.map(words).join(", ")}. Record a clear override reason to continue.`);
      return;
    }
    try {
      setBusy(true);
      await onMarkComplete({
        occurrenceId: occurrence.id,
        ...(note.trim() ? { note: note.trim() } : {}),
        checklistConfirmed,
        ...(reading.trim() ? { reading: reading.trim() } : {}),
        ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
      });
      setAction(null);
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "Completion was not recorded. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitWaive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onWaive) return;
    setError(null);
    if (reason.trim().length < 8) return setError("Enter a clear reason before waiving this occurrence.");
    try {
      setBusy(true);
      await onWaive({ occurrenceId: occurrence.id, reason: reason.trim() });
      setAction(null);
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "The occurrence was not waived. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={classes(styles.root, styles.surface, styles.occurrence, className)}>
      <FormHeader eyebrow={`PM occurrence - ${words(occurrence.status)}`} title={plan.name} description={`${store ? `Store ${store.storeNumber} - ${store.name}` : "Store"} - ${category?.label ?? "Service area"}`} badge={words(occurrence.status)} icon={<CalendarCheck aria-hidden="true" />} />
      <div className={styles.occurrenceSummary}>
        <div><span>Due</span><strong>{formatDate(occurrence.dueAt)}</strong></div>
        <div><span>Cadence</span><strong>{words(plan.cadence)}</strong></div>
        <div><span>Assigned to</span><strong>{assignee ?? "Unassigned"}</strong></div>
        <div><span>Linked work</span><strong>{work?.number ?? "Not created"}</strong></div>
      </div>
      <div className={styles.occurrenceBody}>
        <article className={styles.detailCard}>
          <header><Wrench /><div><h3>Required service</h3><p>{plan.description}</p></div></header>
          <dl className={styles.detailList}>
            <div><dt>Coverage</dt><dd>{asset ? `${asset.assetCode} - ${asset.name}` : `${category?.label ?? "Category"} at store level`}</dd></div>
            <div><dt>Evidence</dt><dd>{plan.requiredEvidence.map(words).join(" - ")}</dd></div>
            <div><dt>Completion</dt><dd>{occurrence.completedAt ? `${formatDate(occurrence.completedAt)}${occurrence.completionNote ? ` - ${occurrence.completionNote}` : ""}` : "Not completed"}</dd></div>
          </dl>
        </article>

        <article className={styles.detailCard}>
          <header><FileCheck2 /><div><h3>Connected work and evidence</h3><p>The occurrence uses the same work order, assignment, visit, and outcome records as reactive service.</p></div></header>
          {work ? <div className={styles.linkedRecord}><span><strong>{work.number} - {work.title}</strong><small>{words(work.status)} - {visits.length} observed {visits.length === 1 ? "visit" : "visits"}</small></span>{onOpenLinkedWorkOrder ? <button type="button" onClick={() => onOpenLinkedWorkOrder(work.id)}>Open work order<ChevronRight /></button> : null}</div> : <div className={styles.emptyState}><Clock3 /><span><strong>No work order yet</strong><small>Create the canonical work record when this occurrence is ready to perform.</small></span>{onCreateWorkOrder && !terminal ? <button type="button" onClick={() => void createWork()} disabled={busy}><Plus />{busy ? "Creating..." : "Create work order"}</button> : null}</div>}
        </article>

        {!terminal && (onMarkComplete || onWaive) ? <article className={classes(styles.detailCard, styles.actionCard)}>
          <header><ShieldCheck /><div><h3>Record the PM outcome</h3><p>Completion and waiver are separate facts. A waiver always requires a visible reason.</p></div></header>
          <div className={styles.actionButtons}>
            {onMarkComplete ? <button type="button" className={styles.secondaryButton} onClick={() => { setAction(action === "complete" ? null : "complete"); setError(null); }}><Check />Mark complete</button> : null}
            {onWaive ? <button type="button" className={styles.secondaryButton} onClick={() => { setAction(action === "waive" ? null : "waive"); setError(null); }}><CircleAlert />Waive with reason</button> : null}
          </div>
          {action === "complete" ? <form className={styles.inlineForm} onSubmit={submitComplete}>
            <div className={styles.detailList}>
              {plan.requiredEvidence.map((requirement) => {
                const satisfied = requirement === "visit" ? hasVisitEvidence : requirement === "photo" ? hasPhotoEvidence : requirement === "checklist" ? checklistConfirmed : Boolean(reading.trim());
                return <div key={requirement}><dt>{words(requirement)}</dt><dd>{satisfied ? "Satisfied" : "Needs evidence or override"}</dd></div>;
              })}
            </div>
            {plan.requiredEvidence.includes("checklist") ? <label><span><input type="checkbox" checked={checklistConfirmed} onChange={(event) => setChecklistConfirmed(event.target.checked)} /> Required service checklist was completed</span></label> : null}
            {plan.requiredEvidence.includes("reading") ? <label>Recorded reading<input value={reading} onChange={(event) => setReading(event.target.value)} placeholder="Example: 37°F supply air; 19 PSI suction" /></label> : null}
            <label>Completion note <small>(optional)</small><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Summarize the preventive service or reference the linked work order." /></label>
            <label>Evidence override reason <small>(required only when an item is missing)</small><textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Explain why completion is valid without the missing evidence." /></label>
            <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Recording..." : "Record completion"}</button>
          </form> : null}
          {action === "waive" ? <form className={styles.inlineForm} onSubmit={submitWaive}><label>Why is this occurrence being waived?<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Unit was replaced before the service window; new asset is covered by a different plan." required /></label><button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Recording..." : "Waive occurrence"}</button></form> : null}
          {error ? <p className={styles.error} role="alert"><CircleAlert />{error}</p> : null}
        </article> : null}
      </div>
    </section>
  );
}
