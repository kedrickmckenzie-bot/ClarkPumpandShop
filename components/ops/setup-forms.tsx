import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Component,
  Info,
  Layers3,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type {
  AddComponentSetupModel,
  CreateAssetSetupModel,
  CreatePmProgramSetupModel,
  CreatePmSetupModel,
  PmPlanScheduleSetupModel,
  SetupOption,
} from "./setup-types";
import styles from "./ops.module.css";

function PageIntro({ model }: { model: CreateAssetSetupModel | AddComponentSetupModel | CreatePmSetupModel | CreatePmProgramSetupModel | PmPlanScheduleSetupModel }) {
  return (
    <header className={styles.formPageHeader}>
      <Link className={styles.backLink} href={model.cancelHref}>
        <ArrowLeft aria-hidden="true" size={17} />{model.cancelLabel}
      </Link>
      <div>
        <p className={styles.eyebrow}>{model.eyebrow}</p>
        <h1>{model.title}</h1>
        <p>{model.description}</p>
        <small>{model.scopeLabel}</small>
      </div>
    </header>
  );
}

function Select({
  id,
  name,
  label,
  options,
  defaultValue,
  required,
  helper,
  emptyLabel = "Select an option",
}: {
  id: string;
  name: string;
  label: string;
  options: SetupOption[];
  defaultValue?: string;
  required?: boolean;
  helper?: string;
  emptyLabel?: string;
}) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}{required ? <em>Required</em> : <small>Optional</small>}</span>
      <select id={id} name={name} required={required} defaultValue={defaultValue ?? ""}>
        <option value="" disabled={required}>{emptyLabel}</option>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

export function CreateAssetSetupForm({ model }: { model: CreateAssetSetupModel }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <form className={styles.recordForm} action={model.submitAction} method="post">
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>1</span><div><h2>Place it in the store</h2><p>Service area and group levels use company language so reports stay consistent across stores.</p></div>
          </div>
          <Select id="asset-store" name="storeId" label="Store" options={model.stores} defaultValue={model.defaultStoreId} required />
          <div className={styles.fieldGrid}>
            <Select id="asset-category" name="categoryKey" label="Service area" options={model.categories} required helper="Service areas are controlled at the company level." />
            <Select id="asset-group-path" name="groupPath" label="Group path" options={model.groupPaths} emptyLabel="No deeper grouping" helper="Choose a company-defined path. Add only the depth that helps your team." />
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>2</span><div><h2>Equipment identity</h2><p>The tag and plain-language name make the record easy to find; technical identity can be completed over time.</p></div>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="asset-tag"><span>Equipment tag <em>Required</em></span><input id="asset-tag" name="assetTag" required placeholder="BEER-CAVE-1" autoComplete="off" /><small>Unique within the selected store.</small></label>
            <label className={styles.field} htmlFor="asset-name"><span>Equipment name <em>Required</em></span><input id="asset-name" name="name" required placeholder="Beer cave evaporator system" autoComplete="off" /></label>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="asset-manufacturer"><span>Manufacturer <small>Optional</small></span><input id="asset-manufacturer" name="manufacturer" autoComplete="organization" /></label>
            <label className={styles.field} htmlFor="asset-model"><span>Model <small>Optional</small></span><input id="asset-model" name="model" autoComplete="off" /></label>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="asset-serial"><span>Serial number <small>Optional</small></span><input id="asset-serial" name="serialNumber" autoComplete="off" /></label>
            <label className={styles.field} htmlFor="asset-supplier"><span>Supplier <small>Optional</small></span><input id="asset-supplier" name="supplier" autoComplete="organization" /></label>
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>3</span><div><h2>Lifecycle inputs</h2><p>These transparent facts support warranty checks, repair history, and future capital review. Nothing here makes an automatic replace decision.</p></div>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="asset-installed"><span>Install date <small>Optional</small></span><input id="asset-installed" name="installedAt" type="date" /></label>
            <label className={styles.field} htmlFor="asset-life"><span>Expected life in years <small>Optional</small></span><input id="asset-life" name="expectedLifeYears" type="number" min="1" max="100" step="1" inputMode="numeric" /></label>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="asset-warranty"><span>Warranty end date <small>Optional</small></span><input id="asset-warranty" name="warrantyEndsAt" type="date" /></label>
            <label className={styles.field} htmlFor="asset-replacement"><span>Replacement estimate <small>Optional</small></span><input id="asset-replacement" name="replacementEstimate" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" /><small>Planning estimate in USD, separate from recorded repair cost.</small></label>
          </div>
          <Select id="asset-status" name="status" label="Current status" options={model.statusOptions} defaultValue="operational" required />
        </section>

        <div className={styles.formNotice}><ShieldCheck aria-hidden="true" size={20} /><p><strong>This is the durable equipment identity.</strong> Components, PM plans, work orders, visits, costs, files, and warranty evidence can attach without duplicating the equipment record.</p></div>
        <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelHref}>Cancel</Link><button className={styles.primaryButton} type="submit">Add equipment<ArrowRight aria-hidden="true" size={18} /></button></div>
      </form>
    </div>
  );
}

export function AddComponentSetupForm({ model }: { model: AddComponentSetupModel }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <form className={styles.recordForm} action={model.submitAction} method="post">
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>1</span><div><h2>Place the component</h2><p>Attach directly to the equipment or choose an existing component as its parent.</p></div>
          </div>
          <div className={styles.formNotice}><Layers3 aria-hidden="true" size={20} /><p><strong>{model.assetName}</strong> · {model.assetTag}<br />{model.storeLabel}</p></div>
          <Select id="component-parent" name="parentComponentId" label="Parent" options={model.parents} defaultValue={model.defaultParentId} emptyLabel="Equipment (top level)" helper="Leave blank to place this component directly below the equipment." />
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>2</span><div><h2>Component identity</h2><p>A clear component name is enough. Part, serial, install, and warranty details remain optional.</p></div>
          </div>
          <label className={styles.field} htmlFor="component-name"><span>Component name <em>Required</em></span><input id="component-name" name="name" required placeholder="Evaporator fan motor" autoComplete="off" /></label>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="component-part"><span>Part number <small>Optional</small></span><input id="component-part" name="partNumber" autoComplete="off" /></label>
            <label className={styles.field} htmlFor="component-serial"><span>Serial number <small>Optional</small></span><input id="component-serial" name="serialNumber" autoComplete="off" /></label>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="component-installed"><span>Install date <small>Optional</small></span><input id="component-installed" name="installedAt" type="date" /></label>
            <label className={styles.field} htmlFor="component-warranty"><span>Warranty end date <small>Optional</small></span><input id="component-warranty" name="warrantyEndsAt" type="date" /></label>
          </div>
        </section>

        <div className={styles.formNotice}><Info aria-hidden="true" size={19} /><p><strong>Component depth is optional.</strong> Use it where repeat repairs, costly parts, or separate warranties make component-level history useful.</p></div>
        <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelHref}>Cancel</Link><button className={styles.primaryButton} type="submit">Add component<ArrowRight aria-hidden="true" size={18} /></button></div>
      </form>
    </div>
  );
}

export function CreatePmSetupForm({ model }: { model: CreatePmSetupModel }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <form className={styles.recordForm} action={model.submitAction} method="post">
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>1</span><div><h2>What should be maintained?</h2><p>A plan may target a specific equipment record or remain store-and-service-area level.</p></div>
          </div>
          <label className={styles.field} htmlFor="pm-name"><span>Plan name <em>Required</em></span><input id="pm-name" name="name" required placeholder="Quarterly beer cave inspection" autoComplete="off" /></label>
          <div className={styles.fieldGrid}>
            <Select id="pm-store" name="storeId" label="Store" options={model.stores} defaultValue={model.defaultStoreId} required />
            <Select id="pm-asset" name="assetId" label="Equipment" options={model.assets} defaultValue={model.defaultAssetId} emptyLabel="No specific equipment" helper="If selected, it must belong to the store above." />
          </div>
          <Select id="pm-category" name="categoryKey" label="Service area" options={model.categories} defaultValue={model.defaultCategoryKey} emptyLabel="No service area selected" helper="When equipment is selected, the service area must match its equipment record." />
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>2</span><div><h2>Set the schedule</h2><p>Cadence defines how often the work repeats. The completion window defines how early or late it may be completed.</p></div>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="pm-cadence"><span>Cadence in days <em>Required</em></span><input id="pm-cadence" name="cadenceDays" type="number" min="1" max="3650" step="1" defaultValue="90" required inputMode="numeric" /><small>Examples: 30 monthly, 90 quarterly, 365 annually.</small></label>
            <label className={styles.field} htmlFor="pm-window"><span>Completion window in days <em>Required</em></span><input id="pm-window" name="completionWindowDays" type="number" min="1" max="365" step="1" defaultValue="7" required inputMode="numeric" /><small>The window applies before and after the due date.</small></label>
          </div>
          <label className={styles.field} htmlFor="pm-first-due"><span>First due date <em>Required</em></span><input id="pm-first-due" name="firstDueAt" type="date" required /></label>
        </section>

        <div className={styles.formNotice}><CalendarClock aria-hidden="true" size={20} /><p><strong>The first occurrence is created now.</strong> It will appear as scheduled, due, or missed based on its exact completion window. Future work orders remain optional until your team chooses to create them.</p></div>
        <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelHref}>Cancel</Link><button className={styles.primaryButton} type="submit">Create plan & first occurrence<ArrowRight aria-hidden="true" size={18} /></button></div>
      </form>
    </div>
  );
}

export function CreatePmProgramSetupForm({ model }: { model: CreatePmProgramSetupModel }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <form className={styles.recordForm} action={model.submitAction} method="post">
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>1</span><div><h2>Name the company schedule</h2><p>Use one plain-language standard that every matching equipment record can inherit.</p></div>
          </div>
          <label className={styles.field} htmlFor="program-name"><span>Master schedule name <em>Required</em></span><input id="program-name" name="name" required placeholder="Quarterly refrigeration preventive service" autoComplete="off" /></label>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>2</span><div><h2>Choose the equipment types</h2><p>Existing matching equipment is enrolled now. Equipment added to a store later is enrolled automatically.</p></div>
          </div>
          <div className={styles.choiceGrid}>
            {model.equipmentTypes.map((option) => (
              <label className={styles.choiceCard} key={option.value}>
                <input type="checkbox" name="equipmentTemplateId" value={option.value} />
                <span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
              </label>
            ))}
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>3</span><div><h2>Set the company cadence</h2><p>This becomes the default at every matching store. A store can later use a faster cadence with a documented reason.</p></div>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="program-cadence"><span>Cadence in days <em>Required</em></span><input id="program-cadence" name="cadenceDays" type="number" min="1" max="3650" defaultValue="90" required inputMode="numeric" /><small>30 monthly · 90 quarterly · 365 annually.</small></label>
            <label className={styles.field} htmlFor="program-window"><span>Completion window in days <em>Required</em></span><input id="program-window" name="completionWindowDays" type="number" min="1" max="365" defaultValue="7" required inputMode="numeric" /><small>Allowed before and after the due date.</small></label>
          </div>
          <label className={styles.field} htmlFor="program-first-due"><span>First company due date <em>Required</em></span><input id="program-first-due" name="firstDueAt" type="date" required /></label>
        </section>

        <div className={styles.formNotice}><CalendarClock aria-hidden="true" size={20} /><p><strong>One setup action creates the whole schedule.</strong> Matching equipment receives a store plan and first occurrence. Future equipment from the selected company types joins the same schedule automatically.</p></div>
        <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelHref}>Cancel</Link><button className={styles.primaryButton} type="submit">Create master schedule<ArrowRight aria-hidden="true" size={18} /></button></div>
      </form>
    </div>
  );
}

export function PmPlanScheduleSetupForm({ model }: { model: PmPlanScheduleSetupModel }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <form className={styles.recordForm} action={model.submitAction} method="post">
        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>1</span><div><h2>Schedule inherited by this store</h2><p>The equipment stays connected to the company program; only this store&apos;s future cadence changes.</p></div>
          </div>
          <div className={styles.formNotice}><Layers3 aria-hidden="true" size={20} /><p><strong>{model.assetLabel}</strong> · {model.storeLabel}<br />{model.masterProgramName ? `${model.masterProgramName}: every ${model.masterCadenceDays} days with a ${model.masterWindowDays}-day window.` : "This is a store-created plan without a master program."}</p></div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formSectionHeading}>
            <span>2</span><div><h2>Set the local cadence</h2><p>Use this for higher-volume stores, unusual operating conditions, or another documented local need.</p></div>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="plan-cadence"><span>Cadence in days <em>Required</em></span><input id="plan-cadence" name="cadenceDays" type="number" min="1" max="3650" defaultValue={model.cadenceDays} required inputMode="numeric" /></label>
            <label className={styles.field} htmlFor="plan-window"><span>Completion window in days <em>Required</em></span><input id="plan-window" name="completionWindowDays" type="number" min="1" max="365" defaultValue={model.completionWindowDays} required inputMode="numeric" /></label>
          </div>
          <label className={styles.field} htmlFor="plan-reason"><span>Why this store is different <em>Required</em></span><textarea id="plan-reason" name="reason" required maxLength={500} defaultValue={model.overrideReason} placeholder="This location has extended hours and higher refrigeration traffic." /><small>The reason remains visible with the local override.</small></label>
        </section>

        <div className={styles.formNotice}><Info aria-hidden="true" size={20} /><p><strong>The current occurrence is not rewritten.</strong> The scheduler uses this cadence for future cycles, preserving prior due dates and compliance evidence.</p></div>
        <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelHref}>Cancel</Link><button className={styles.primaryButton} type="submit">Save store schedule<ArrowRight aria-hidden="true" size={18} /></button></div>
      </form>
    </div>
  );
}

export function SetupActions({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: Array<{ label: string; href: string; kind?: "primary" | "secondary"; icon?: "asset" | "component" | "pm" | "work" }>;
}) {
  const icons = {
    asset: Wrench,
    component: Component,
    pm: CalendarClock,
    work: Plus,
  };
  return (
    <section className={styles.formSection} aria-label={title}>
      <div className={styles.formSectionHeading}>
        <span><Plus aria-hidden="true" size={18} /></span><div><h2>{title}</h2><p>{description}</p></div>
      </div>
      <div className={styles.formFooter}>
        {actions.map((action) => {
          const Icon = icons[action.icon ?? "asset"];
          return <Link className={action.kind === "secondary" ? styles.secondaryButton : styles.primaryButton} href={action.href} key={action.href}><Icon aria-hidden="true" size={17} />{action.label}</Link>;
        })}
      </div>
    </section>
  );
}
