import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, Send, ShieldCheck } from "lucide-react";
import type {
  CreateRequestPageViewModel,
  CreateStorePageViewModel,
  CreateVendorPageViewModel,
  CreateWorkOrderPageViewModel,
  DataState,
  SelectOptionViewModel,
  VendorIssuanceViewModel,
} from "./data-contract";
import { DataStatePanel } from "./views";
import styles from "./ops.module.css";

function PageIntro({ model }: { model: CreateRequestPageViewModel | CreateWorkOrderPageViewModel | CreateStorePageViewModel | CreateVendorPageViewModel }) {
  return (
    <header className={styles.formPageHeader}>
      <Link className={styles.backLink} href={model.cancelLink.href}><ArrowLeft aria-hidden="true" size={17} />{model.cancelLink.label}</Link>
      <div>
        {model.page.eyebrow ? <p className={styles.eyebrow}>{model.page.eyebrow}</p> : null}
        <h1>{model.page.title}</h1>
        <p>{model.page.description}</p>
        <small>{model.page.scopeLabel}</small>
      </div>
    </header>
  );
}

function Datalist({ id, options }: { id: string; options: SelectOptionViewModel[] }) {
  return <datalist id={id}>{options.map((option) => <option value={option.value} label={option.label} key={option.value}>{option.description}</option>)}</datalist>;
}

function SelectField({ id, name, label, options, required, helper }: { id: string; name: string; label: string; options: SelectOptionViewModel[]; required?: boolean; helper?: string }) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}{required ? <em>Required</em> : <small>Optional</small>}</span>
      <select id={id} name={name} required={required} defaultValue="">
        <option value="" disabled={required}>Select an option</option>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function ModelState({ state }: { state: DataState }) {
  return state.kind === "ready" ? null : <DataStatePanel state={state} />;
}

export function CreateRequestForm({ model }: { model: CreateRequestPageViewModel }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <ModelState state={model.state} />
      {model.state.kind === "ready" ? (
        <form className={styles.recordForm} action={model.submitAction} method="post">
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Where is the issue?</h2><p>Choose the store so the request reaches the right manager.</p></div></div>
            <label className={styles.field} htmlFor="request-store">
              <span>Store <em>Required</em></span>
              <input id="request-store" name="storeId" list="request-store-options" required placeholder="Search by store number, name, or address" autoComplete="off" />
              <Datalist id="request-store-options" options={model.stores} />
              <small>Select a result supplied by the organization store directory.</small>
            </label>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>What needs attention?</h2><p>A clear description is enough to submit. Equipment can be classified later.</p></div></div>
            <label className={styles.field} htmlFor="request-problem">
              <span>Problem <em>Required</em></span>
              <textarea id="request-problem" name="problem" required minLength={10} rows={5} placeholder="Describe what is happening, where it is, and any immediate safety concern." />
              <small>Do not diagnose the issue unless you are confident. Describe what you can observe.</small>
            </label>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="request-reporter">
                <span>Your name <em>Required</em></span>
                <input id="request-reporter" name="reporterName" required autoComplete="name" />
              </label>
              <label className={styles.field} htmlFor="request-employee-id">
                <span>Employee ID <small>Optional</small></span>
                <input id="request-employee-id" name="reporterEmployeeId" autoComplete="off" />
              </label>
            </div>
            <SelectField id="request-priority" name="priority" label="Priority" required options={model.priorityOptions} helper="Use emergency only for immediate safety, fuel, food-safety, or major operating impact." />
          </section>

          <div className={styles.formNotice}><Info aria-hidden="true" size={19} /><p><strong>This creates a visible record.</strong> Managers can review, classify, approve, and convert it to a work order without erasing the original report.</p></div>
          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Submit request<ArrowRight aria-hidden="true" size={18} /></button></div>
        </form>
      ) : null}
    </div>
  );
}

export function CreateWorkOrderForm({ model, componentId }: { model: CreateWorkOrderPageViewModel; componentId?: string }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <ModelState state={model.state} />
      {model.state.kind === "ready" ? (
        <form className={styles.recordForm} action={model.submitAction} method="post">
          {model.sourceRequest ? <input type="hidden" name="requestId" value={model.sourceRequest.id} /> : null}
          {componentId ? <input type="hidden" name="componentId" value={componentId} /> : null}
          {componentId ? (
            <div className={styles.formNotice}>
              <Info aria-hidden="true" size={19} />
              <p><strong>Component-level work.</strong> This work order will stay classified to the component you opened, so its repair, visit, and cost history remain connected.</p>
            </div>
          ) : null}
          {model.sourceRequest ? (
            <div className={styles.formNotice}>
              <Info aria-hidden="true" size={19} />
              <p><strong>Converting {model.sourceRequest.reference}.</strong> Reported by {model.sourceRequest.reporterName} {model.sourceRequest.submittedLabel}. The original request remains in the audit trail.</p>
            </div>
          ) : null}
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Define the work</h2><p>Only the store and problem are required. Classification stays honest when details are not yet known.</p></div></div>
            <label className={styles.field} htmlFor="work-store">
              <span>Store <em>Required</em></span>
              <input id="work-store" name="storeId" list="work-store-options" required placeholder="Search store number, name, or address" autoComplete="off" defaultValue={model.sourceRequest?.storeId ?? model.defaults?.storeId} />
              <Datalist id="work-store-options" options={model.stores} />
            </label>
            <label className={styles.field} htmlFor="work-problem">
              <span>Problem <em>Required</em></span>
              <textarea id="work-problem" name="problem" rows={5} required minLength={10} placeholder="What needs to be inspected, repaired, or maintained?" defaultValue={model.sourceRequest?.problem} />
            </label>
            <div className={styles.fieldGrid}>
              <SelectField id="work-priority" name="priority" label="Priority" required options={model.priorityOptions} />
              <label className={styles.field} htmlFor="work-category">
                <span>Category <small>Optional</small></span>
                <input id="work-category" name="categoryKey" list="work-category-options" placeholder="Classify now or leave blank" autoComplete="off" defaultValue={model.defaults?.categoryKey} />
                <Datalist id="work-category-options" options={model.categories} />
              </label>
            </div>
            <label className={styles.field} htmlFor="work-asset">
              <span>Equipment or asset <small>Optional — can be deferred</small></span>
              <input id="work-asset" name="assetId" list="work-asset-options" placeholder="Search an asset, or leave blank when unknown" autoComplete="off" defaultValue={model.defaults?.assetId} />
              <Datalist id="work-asset-options" options={model.assets} />
              <small>Leaving this blank will not create a placeholder asset. It can be linked after diagnosis.</small>
            </label>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>Choose how it will be handled</h2><p>Route internally, send to an approved vendor, or decide after review.</p></div></div>
            <fieldset className={styles.assignmentChoices}>
              <legend>Assignment route <span>Required</span></legend>
              <label htmlFor="assignment-internal" aria-label="Internal maintenance"><input id="assignment-internal" type="radio" name="assignmentKind" value="internal" required /><span><strong>Internal maintenance</strong><small>Assign to your own maintenance team.</small></span></label>
              <label htmlFor="assignment-vendor" aria-label="Outside vendor"><input id="assignment-vendor" type="radio" name="assignmentKind" value="outside_vendor" /><span><strong>Outside vendor</strong><small>Create the authorization, then issue it to an approved vendor.</small></span></label>
              <label htmlFor="assignment-later" aria-label="Choose later"><input id="assignment-later" type="radio" name="assignmentKind" value="choose_later" /><span><strong>Choose later</strong><small>Save the work order without blocking urgent reporting.</small></span></label>
            </fieldset>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="work-vendor">
                <span>Outside vendor <small>Required only when routed outside</small></span>
                <input id="work-vendor" name="vendorId" list="work-vendor-options" placeholder="Search name, specialty, equipment, or coverage" autoComplete="off" />
                <Datalist id="work-vendor-options" options={model.vendors} />
              </label>
              <SelectField id="work-internal-assignee" name="internalMembershipId" label="Internal assignee" options={model.internalAssignees} helper="Can be assigned after creation." />
            </div>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>3</span><div><h2>Set guardrails</h2><p>These fields help the recipient understand the authorization; they do not turn TraceOps into purchasing software.</p></div></div>
            <label className={styles.field} htmlFor="work-scope">
              <span>Authorized scope <small>Optional</small></span>
              <textarea id="work-scope" name="authorizedScope" rows={4} placeholder="Define what is authorized and when approval is required before expanding the work." />
            </label>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="work-nte">
                <span>Not-to-exceed amount <small>Optional</small></span>
                <input id="work-nte" name="nteAmount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" />
              </label>
              <label className={styles.field} htmlFor="work-due">
                <span>Requested by <small>Optional</small></span>
                <input id="work-due" name="dueAt" type="datetime-local" />
              </label>
            </div>
          </section>

          <div className={styles.formNotice}><ShieldCheck aria-hidden="true" size={20} /><p><strong>Creation does not automatically issue work.</strong> Outside work is sent only through the versioned service-authorization action on the saved work order.</p></div>
          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Create work order<ArrowRight aria-hidden="true" size={18} /></button></div>
        </form>
      ) : null}
    </div>
  );
}

export function VendorIssuancePanel({ model }: { model: VendorIssuanceViewModel }) {
  if (!model.available) return null;
  return (
    <section className={styles.issuancePanel} id="issue-work" aria-labelledby="issue-work-heading">
      <div className={styles.formSectionHeading}><span><Send aria-hidden="true" size={18} /></span><div><h2 id="issue-work-heading">Issue service authorization</h2><p>{model.helperText}</p></div></div>
      {!model.permitted ? <p className={styles.inlineEmpty}>Your role can review this authorization but cannot issue it.</p> : (
        <form action={model.submitAction} method="post" target="_blank">
          <input type="hidden" name="workOrderId" value={model.workOrderId} />
          {model.currentRevision !== undefined ? <input type="hidden" name="expectedRevision" value={model.currentRevision} /> : null}
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor="issuance-vendor">
              <span>Approved vendor <em>Required</em></span>
              <select id="issuance-vendor" name="vendorId" required defaultValue={model.selectedVendorId ?? ""}>
                <option value="" disabled>Select an approved vendor</option>
                {model.vendors.map((vendor) => <option value={vendor.value} key={vendor.value}>{vendor.label}</option>)}
              </select>
            </label>
            <SelectField id="issuance-channel" name="channel" label="Send by" required options={model.channels} />
          </div>
          <label className={styles.field} htmlFor="issuance-message">
            <span>Message to dispatch <small>Optional</small></span>
            <textarea id="issuance-message" name="message" rows={3} placeholder="Add access timing or a dispatch note. The authorization record remains the source of truth." />
          </label>
          <div className={styles.formFooter}><span className={styles.formMeta}>{model.workOrderNumber}{model.currentRevision ? ` · next revision ${model.currentRevision + 1}` : ""}</span><button className={styles.primaryButton} type="submit">Issue to vendor<Send aria-hidden="true" size={17} /></button></div>
        </form>
      )}
    </section>
  );
}

export function CreateStoreForm({ model }: { model: CreateStorePageViewModel }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <ModelState state={model.state} />
      {model.state.kind === "ready" ? (
        <form className={styles.recordForm} action={model.submitAction} method="post">
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Store identity</h2><p>Create the stable store record people will use across requests, work, visits, equipment, and reporting.</p></div></div>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="store-number"><span>Store number <em>Required</em></span><input id="store-number" name="storeNumber" required autoComplete="off" /></label>
              <label className={styles.field} htmlFor="store-name"><span>Store name <em>Required</em></span><input id="store-name" name="name" required autoComplete="organization" /></label>
            </div>
            <label className={styles.field} htmlFor="store-aliases"><span>Search aliases <small>Optional</small></span><input id="store-aliases" name="aliases" placeholder="Former number, neighborhood, or commonly used name" /><small>Separate multiple aliases with commas. Aliases improve search without changing the official store number.</small></label>
            <SelectField id="store-region" name="regionId" label="Region" options={model.regions} helper="A store can be assigned or moved later without changing its stable ID." />
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>Location</h2><p>Use a structured address so search, service authorizations, and optional visit evidence stay consistent.</p></div></div>
            <label className={styles.field} htmlFor="store-address-1"><span>Address line 1 <em>Required</em></span><input id="store-address-1" name="address1" required autoComplete="address-line1" /></label>
            <label className={styles.field} htmlFor="store-address-2"><span>Address line 2 <small>Optional</small></span><input id="store-address-2" name="address2" autoComplete="address-line2" /></label>
            <div className={styles.addressGrid}>
              <label className={styles.field} htmlFor="store-city"><span>City <em>Required</em></span><input id="store-city" name="city" required autoComplete="address-level2" /></label>
              <label className={styles.field} htmlFor="store-state"><span>State <em>Required</em></span><input id="store-state" name="state" required maxLength={2} autoComplete="address-level1" /></label>
              <label className={styles.field} htmlFor="store-postal"><span>Postal code <em>Required</em></span><input id="store-postal" name="postalCode" required autoComplete="postal-code" /></label>
            </div>
            <SelectField id="store-timezone" name="timeZone" label="Time zone" options={model.timeZones} helper="Defaults to the organization time zone when left blank." />
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>3</span><div><h2>Visit evidence policy</h2><p>Location evidence is optional and captured only at check-in and checkout—never continuously.</p></div></div>
            <label className={styles.checkField} htmlFor="store-location-policy" aria-label="Enable point-in-time location evidence"><input id="store-location-policy" type="checkbox" name="locationPolicyEnabled" value="true" /><span><strong>Enable point-in-time location evidence</strong><small>Technicians can still use a trusted store device when location is unavailable.</small></span></label>
            <label className={styles.field} htmlFor="store-geofence"><span>Geofence radius in meters <small>Optional</small></span><input id="store-geofence" name="geofenceRadiusM" type="number" min="25" max="2000" step="5" /><small>Configure after the address is verified. This is evidence context, not automatic proof of labor.</small></label>
          </section>

          <div className={styles.formNotice}><Info aria-hidden="true" size={19} /><p><strong>Start with the store.</strong> Cost centers, equipment, components, PM plans, access notes, QR material, and local users are separate next steps—not blockers to creating the location.</p></div>
          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Create store<ArrowRight aria-hidden="true" size={18} /></button></div>
        </form>
      ) : null}
    </div>
  );
}

export function CreateVendorForm({ model }: { model: CreateVendorPageViewModel }) {
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <ModelState state={model.state} />
      {model.state.kind === "ready" ? (
        <form className={styles.recordForm} action={model.submitAction} method="post">
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Vendor profile</h2><p>Add the approved service company and a reliable dispatch contact. A portal account is not required.</p></div></div>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="vendor-name"><span>Vendor name <em>Required</em></span><input id="vendor-name" name="name" required autoComplete="organization" /></label>
              <label className={styles.field} htmlFor="vendor-code"><span>Vendor code <small>Optional</small></span><input id="vendor-code" name="code" autoComplete="off" /></label>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="vendor-email"><span>Dispatch email <em>Required</em></span><input id="vendor-email" name="dispatchEmail" type="email" required autoComplete="email" /></label>
              <label className={styles.field} htmlFor="vendor-phone"><span>Dispatch phone <small>Optional</small></span><input id="vendor-phone" name="dispatchPhone" type="tel" autoComplete="tel" /></label>
            </div>
            <label className={styles.checkField} htmlFor="vendor-preferred" aria-label="Preferred vendor"><input id="vendor-preferred" type="checkbox" name="preferred" value="true" /><span><strong>Preferred vendor</strong><small>Preferred status can improve search ranking within approved coverage; it does not auto-award work.</small></span></label>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>What they service</h2><p>Use company-standard specialties plus plain-language aliases people may search.</p></div></div>
            <label className={styles.field} htmlFor="vendor-specialties">
              <span>Specialties <em>Required</em></span>
              <input id="vendor-specialties" name="specialtyKeys" list="vendor-specialty-options" required placeholder="Search plumbing, refrigeration, dispenser, electrical, or equipment" autoComplete="off" />
              <Datalist id="vendor-specialty-options" options={model.specialties} />
              <small>The server may accept multiple approved specialty keys; deeper equipment mapping can be added later.</small>
            </label>
            <label className={styles.field} htmlFor="vendor-aliases"><span>Search aliases <small>Optional</small></span><input id="vendor-aliases" name="searchAliases" placeholder="Plumber, beer cave, walk-in, pumps, canopy lights" /><small>Aliases help managers find the right vendor using ordinary language.</small></label>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>3</span><div><h2>Approved coverage</h2><p>Limit where this vendor can appear in outside-work search.</p></div></div>
            <label className={styles.field} htmlFor="vendor-coverage">
              <span>Coverage <em>Required</em></span>
              <input id="vendor-coverage" name="coverageScopeIds" list="vendor-coverage-options" required placeholder="Search company, region, or store" autoComplete="off" />
              <Datalist id="vendor-coverage-options" options={model.coverageScopes} />
            </label>
          </section>

          <div className={styles.formNotice}><ShieldCheck aria-hidden="true" size={20} /><p><strong>Approval is controlled by the operator.</strong> Insurance documents, rates, portal users, response preferences, and store relationships can be added later without delaying basic work-order issuance.</p></div>
          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Add approved vendor<ArrowRight aria-hidden="true" size={18} /></button></div>
        </form>
      ) : null}
    </div>
  );
}
