import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, Route, Send, ShieldCheck } from "lucide-react";
import type {
  CreateRequestPageViewModel,
  CreateStorePageViewModel,
  CreateVendorPageViewModel,
  CreateWorkOrderPageViewModel,
  DataState,
  DemoEdition,
  SelectOptionViewModel,
  VendorIssuanceViewModel,
} from "./data-contract";
import { DataStatePanel } from "./views";
import { WorkOrderLifecycleFields } from "./work-order-lifecycle-fields";
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

function SelectField({ id, name, label, options, required, helper, defaultValue, className }: { id: string; name: string; label: string; options: SelectOptionViewModel[]; required?: boolean; helper?: string; defaultValue?: string; className?: string }) {
  return (
    <label className={[styles.field, className].filter(Boolean).join(" ")} htmlFor={id}>
      <span>{label}{required ? <em>Required</em> : <small>Optional</small>}</span>
      <select id={id} name={name} required={required} defaultValue={defaultValue ?? ""}>
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
              <small>Choose one of the stores shown in the search results.</small>
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

          <div className={styles.formNotice}><Info aria-hidden="true" size={19} /><p><strong>You do not need equipment details or a diagnosis.</strong> This creates a visible record that a manager can review, classify, and turn into work without changing the original report.</p></div>
          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Submit request<ArrowRight aria-hidden="true" size={18} /></button></div>
        </form>
      ) : null}
    </div>
  );
}

export function CreateWorkOrderForm({ model, componentId, edition = "complete" }: { model: CreateWorkOrderPageViewModel; componentId?: string; edition?: DemoEdition }) {
  const accountabilityOnly = edition === "accountability";
  const sourceStoreLabel = model.sourceVisit ? model.stores.find((store) => store.value === model.defaults?.storeId)?.label : undefined;
  const sourceVendorLabel = model.sourceVisit ? model.vendors.find((vendor) => vendor.value === model.defaults?.vendorId)?.label : undefined;
  const sourceInternalLabel = model.sourceVisit ? model.internalAssignees.find((member) => member.value === model.defaults?.internalMembershipId)?.label : undefined;
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <ModelState state={model.state} />
      {model.state.kind === "ready" ? (
        <form className={styles.recordForm} action={model.submitAction} method="post">
          {model.sourceRequest ? <input type="hidden" name="requestId" value={model.sourceRequest.id} /> : null}
          {model.sourceVisit ? <input type="hidden" name="sourceExceptionId" value={model.sourceVisit.exceptionId} /> : null}
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
          {model.sourceVisit ? (
            <div className={styles.formNotice}>
              <Route aria-hidden="true" size={19} />
              <p><strong>Documenting work after service began.</strong> {model.sourceVisit.technicianName} from {model.sourceVisit.providerName} checked in {model.sourceVisit.checkedInLabel}. The new work order will be created now and linked by an auditable amendment. It will not backdate authorization or alter the original “{model.sourceVisit.unmatchedReason}” check-in assertion.</p>
            </div>
          ) : null}
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Define the work</h2><p>Only the store and problem are required. Classification stays honest when details are not yet known.</p></div></div>
            <label className={styles.field} htmlFor="work-store">
              <span>Store <em>Required</em></span>
              {model.sourceVisit ? <><input name="storeId" type="hidden" value={model.defaults?.storeId} /><input id="work-store" readOnly value={sourceStoreLabel ?? model.defaults?.storeId ?? "Bound store"} /></> : <><input id="work-store" name="storeId" list="work-store-options" required placeholder="Search store number, name, or address" autoComplete="off" defaultValue={model.sourceRequest?.storeId ?? model.defaults?.storeId} /><Datalist id="work-store-options" options={model.stores} /></>}
            </label>
            <label className={styles.field} htmlFor="work-problem">
              <span>Problem <em>Required</em></span>
              <textarea id="work-problem" name="problem" rows={5} required minLength={10} placeholder="What needs to be inspected, repaired, or maintained?" defaultValue={model.sourceRequest?.problem ?? model.defaults?.problem} />
            </label>
            <SelectField id="work-priority" name="priority" label="Priority" required options={model.priorityOptions} defaultValue={model.defaults?.priority} />
            {!accountabilityOnly ? (
              <details className={styles.optionalFormSection} open={Boolean(componentId || model.defaults?.assetId || model.defaults?.categoryKey)}>
                <summary><strong>Classify equipment</strong><span>Optional — add a category or known asset now, or leave it for diagnosis</span></summary>
                <div className={styles.optionalFormBody}>
                  <label className={styles.field} htmlFor="work-category">
                    <span>Category <small>Optional</small></span>
                    <input id="work-category" name="categoryKey" list="work-category-options" placeholder="Classify now or leave blank" autoComplete="off" defaultValue={model.defaults?.categoryKey} />
                    <Datalist id="work-category-options" options={model.categories} />
                  </label>
                  <WorkOrderLifecycleFields assets={model.assetLifecycleInputs} asOf={model.lifecycleAsOf} defaultAssetId={model.defaults?.assetId} />
                </div>
              </details>
            ) : null}
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>{model.sourceVisit ? "Confirm who performed the visit" : accountabilityOnly ? "Choose the vendor" : "Choose the service path"}</h2><p>{model.sourceVisit ? "The provider comes from the observed check-in and cannot be silently replaced while this record is created." : accountabilityOnly ? "Select the outside vendor now or save the work order and choose one later." : "Use a known provider, request pricing first, route internally, or decide later."}</p></div></div>
            {model.sourceVisit ? (
              <div className={styles.formNotice}>
                <Route aria-hidden="true" size={19} />
                <input type="hidden" name="assignmentKind" value={model.defaults?.assignmentKind} />
                {model.defaults?.vendorId ? <input type="hidden" name="vendorId" value={model.defaults.vendorId} /> : null}
                {model.defaults?.internalMembershipId ? <input type="hidden" name="internalMembershipId" value={model.defaults.internalMembershipId} /> : null}
                <p><strong>Provider preserved from check-in.</strong> {sourceVendorLabel ?? sourceInternalLabel ?? model.sourceVisit.providerName} will stay attached to this visit-derived work order. Change the provider later only through an auditable reassignment.</p>
              </div>
            ) : <><fieldset className={styles.assignmentChoices}>
              <legend>Next step <span>Required</span></legend>
              {!accountabilityOnly ? <label htmlFor="assignment-internal" aria-label="Internal maintenance"><input id="assignment-internal" type="radio" name="assignmentKind" value="internal" required defaultChecked={model.defaults?.assignmentKind === "internal"} /><span><strong>Internal maintenance</strong><small>Assign to your own maintenance team.</small></span></label> : null}
              <label htmlFor="assignment-vendor" aria-label="Outside vendor"><input id="assignment-vendor" type="radio" name="assignmentKind" value="outside_vendor" required={accountabilityOnly} defaultChecked={model.defaults?.assignmentKind === "outside_vendor" || (accountabilityOnly && Boolean(model.defaults?.vendorId))} /><span><strong>Outside vendor</strong><small>Choose the vendor now, then send a service authorization. Technician check-in applies after it is issued.</small></span></label>
              {!accountabilityOnly ? <label htmlFor="assignment-bid" aria-label="Request vendor bids"><input id="assignment-bid" type="radio" name="assignmentKind" value="bid_request" /><span><strong>Request bids first</strong><small>Ask vendors for pricing by a due date. No vendor is assigned and no check-in is available.</small></span></label> : null}
              {!accountabilityOnly ? <label htmlFor="assignment-hold" aria-label="Approve for later"><input id="assignment-hold" type="radio" name="assignmentKind" value="hold_for_visit" /><span><strong>Approve for later</strong><small>Approve this now, then offer it when a suitable vendor is already at the store.</small></span></label> : null}
              <label htmlFor="assignment-later" aria-label="Decide later"><input id="assignment-later" type="radio" name="assignmentKind" value="choose_later" defaultChecked={model.defaults?.assignmentKind === "choose_later" || (accountabilityOnly && !model.defaults?.vendorId && model.defaults?.assignmentKind !== "outside_vendor")} /><span><strong>Choose later</strong><small>Save the work order now and select the vendor before sending it.</small></span></label>
            </fieldset>
            <div className={`${styles.fieldGrid} ${styles.providerFieldGrid}`}>
              <label className={`${styles.field} ${styles.vendorConditional}`} htmlFor="work-vendor">
                <span>Service vendor <small>Required only for “Outside vendor”</small></span>
                <input id="work-vendor" name="vendorId" list="work-vendor-options" placeholder="Search name, specialty, equipment, or coverage" autoComplete="off" defaultValue={model.defaults?.vendorId} />
                <Datalist id="work-vendor-options" options={model.vendors} />
              </label>
              {!accountabilityOnly ? <SelectField id="work-internal-assignee" name="internalMembershipId" label="Internal assignee" options={model.internalAssignees} helper="Can be assigned after creation." defaultValue={model.defaults?.internalMembershipId} className={styles.internalConditional} /> : null}
            </div>
            {!accountabilityOnly ? <div className={styles.holdConditional}>
              <div className={styles.formNotice}><Route aria-hidden="true" size={19} /><p><strong>Approved work, no separate trip yet.</strong> A matching vendor may choose this work when already onsite. The technician is never asked to price it or wait for approval.</p></div>
              <div className={styles.fieldGrid}>
                <SelectField id="hold-posture" name="holdPosture" label="What may the vendor do?" options={[{ value: "complete_using_professional_judgment", label: "Complete during the visit if practical" }, { value: "look_and_report", label: "Inspect and report back" }]} defaultValue="complete_using_professional_judgment" />
                <label className={styles.field} htmlFor="hold-deadline"><span>Review by <em>Required for held work</em></span><input id="hold-deadline" name="holdDeadlineAt" type="datetime-local" /></label>
                <label className={styles.field} htmlFor="hold-review-threshold"><span>Internal invoice-review threshold <small>Optional</small></span><input id="hold-review-threshold" name="holdInternalReviewThreshold" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Not shown to the vendor" /><small>This is a later review signal—not a price, authorization, or technician stop.</small></label>
              </div>
            </div> : null}
            </>}
          </section>

          <details className={`${styles.formSection} ${styles.optionalServiceSection}`}>
            <summary className={styles.formSectionHeading}><span>3</span><div><h2>{model.sourceVisit ? "Add what was requested" : "Add service details"}</h2><p>{model.sourceVisit ? "Optionally document the verbal scope or timing without presenting it as a prior written authorization." : accountabilityOnly ? "Optional scope or requested service date." : "Optional scope, spending limit, or requested date. Open this when the vendor needs more than the problem description."}</p></div></summary>
            <div className={styles.optionalServiceBody}>
              <label className={styles.field} htmlFor="work-scope">
                <span>{model.sourceVisit ? "Reported verbal scope" : "Authorized scope"} <small>Optional</small></span>
                <textarea id="work-scope" name="authorizedScope" rows={4} placeholder={model.sourceVisit ? "Record what the caller asked the vendor to inspect or address." : "Define what is authorized and when approval is required before expanding the work."} />
              </label>
              <div className={styles.fieldGrid}>
                {!accountabilityOnly && !model.sourceVisit ? <label className={styles.field} htmlFor="work-nte">
                  <span>Not-to-exceed amount <small>Optional</small></span>
                  <input id="work-nte" name="nteAmount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" />
                </label> : null}
                <label className={styles.field} htmlFor="work-due">
                  <span>Requested by <small>Optional</small></span>
                  <input id="work-due" name="dueAt" type="datetime-local" />
                </label>
              </div>
            </div>
          </details>

          <div className={styles.formNotice}><ShieldCheck aria-hidden="true" size={20} /><p>{model.sourceVisit ? <><strong>This is an after-the-fact work order.</strong> It gives the visit, future cost entries, and optional invoice evidence one operator reference while preserving when the service actually began and how it was requested.</> : accountabilityOnly ? <><strong>Creating the work order does not invent a visit.</strong> For outside-vendor work, “Create and send to vendor” issues the authorization immediately; approval policy still stops the send when review is required.</> : <><strong>A bid request and a service authorization are different records.</strong> Bid requests ask for numbers only. “Create and send to vendor” is the short path for known outside-vendor work and still honors configured approval rules.</>}</p></div>
          <div className={styles.formFooter}>
            <Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link>
            <button className={model.sourceVisit ? styles.primaryButton : styles.secondaryButton} type="submit" name="intent" value="save">{model.sourceVisit ? "Create and link work order" : "Create only"}</button>
            {!model.sourceVisit ? <button className={`${styles.primaryButton} ${styles.sendConditional}`} type="submit" name="intent" value="create_and_send">Create and send to vendor<Send aria-hidden="true" size={18} /></button> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function VendorIssuancePanel({ model, edition = "complete" }: { model: VendorIssuanceViewModel; edition?: DemoEdition }) {
  if (!model.available) return null;
  const accountabilityOnly = edition === "accountability";
  return (
    <section className={styles.issuancePanel} id="issue-work" aria-labelledby="issue-work-heading">
      <div className={styles.formSectionHeading}><span><Send aria-hidden="true" size={18} /></span><div><h2 id="issue-work-heading">{accountabilityOnly ? "Send work order" : "Service path"}</h2><p>{accountabilityOnly ? "Choose the vendor and generate the account-free work-order link they will receive." : model.helperText}</p></div></div>
      {!model.rolePermitted ? (
        <p className={styles.inlineEmpty}>Your role can review the service path but cannot send a service authorization.</p>
      ) : model.workflowBlocked ? (
        <p className={styles.inlineEmpty} role="status"><strong>Service path paused.</strong> {model.workflowBlockMessage}</p>
      ) : !model.permitted ? (
        <p className={styles.inlineEmpty}>Service authorization is unavailable while this work order is in its current state.</p>
      ) : (
        <details className={styles.controlDisclosure} open={!model.currentRevision}>
          <summary className={styles.controlDisclosureSummary}><Send aria-hidden="true" size={18} /><span><strong>{model.currentRevision ? `Prepare service-authorization revision ${model.currentRevision + 1}` : "Choose a vendor and prepare the service authorization"}</strong><small>{accountabilityOnly ? "This sends the vendor work order and enables technician check-in." : "This authorizes service. It is not a bid request."}</small></span></summary>
          <form action={model.submitAction} method="post" target="_blank">
            <input type="hidden" name="workOrderId" value={model.workOrderId} />
            {model.currentRevision !== undefined ? <input type="hidden" name="expectedRevision" value={model.currentRevision} /> : null}
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="issuance-vendor">
                <span>Approved vendor <em>Required</em></span>
                {model.vendorSelectionLocked ? (
                  <>
                    <input name="vendorId" type="hidden" value={model.selectedVendorId} />
                    <input id="issuance-vendor" readOnly value={model.vendors[0]?.label ?? "Selected vendor unavailable"} />
                    <small>{accountabilityOnly ? "Current vendor selection; later changes remain auditable." : "Locked to the vendor selected from the bid comparison."}</small>
                  </>
                ) : (
                  <select id="issuance-vendor" name="vendorId" required defaultValue={model.selectedVendorId ?? ""}>
                    <option value="" disabled>Select an approved vendor</option>
                    {model.vendors.map((vendor) => <option value={vendor.value} key={vendor.value}>{vendor.label}</option>)}
                  </select>
                )}
              </label>
              <SelectField id="issuance-channel" name="channel" label="Handoff method" required options={model.channels} />
            </div>
            <label className={styles.field} htmlFor="issuance-message">
              <span>Service note <small>Optional</small></span>
              <textarea id="issuance-message" name="message" rows={3} placeholder="Add access timing or a service note. The authorization record remains the source of truth." />
            </label>
            <div className={styles.formFooter}><span className={styles.formMeta}>{model.workOrderNumber}{model.currentRevision ? ` · next revision ${model.currentRevision + 1}` : ""}</span><button className={styles.primaryButton} type="submit">Generate service authorization<Send aria-hidden="true" size={17} /></button></div>
          </form>
        </details>
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
            <SelectField id="store-timezone" name="timeZone" label="Store time zone" options={model.timeZones} defaultValue={model.defaultTimeZone} required helper="Confirm the zone at this store address. Visit evidence, camera lookup times, deadlines, and vendor scheduling use this value—never the viewer's device clock." />
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
              <small>Enter one or more approved specialty keys, separated by commas.</small>
            </label>
            <label className={styles.field} htmlFor="vendor-aliases"><span>Search aliases <small>Optional</small></span><input id="vendor-aliases" name="searchAliases" placeholder="Plumber, beer cave, walk-in, pumps, canopy lights" /><small>Aliases help managers find the right vendor using ordinary language.</small></label>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>3</span><div><h2>Approved coverage</h2><p>Limit where this vendor can appear in outside-work search.</p></div></div>
            <label className={styles.field} htmlFor="vendor-coverage">
              <span>Coverage <em>Required</em></span>
              <input id="vendor-coverage" name="coverageScopeIds" list="vendor-coverage-options" required placeholder="Search company, region, or store" autoComplete="off" />
              <Datalist id="vendor-coverage-options" options={model.coverageScopes} />
              <small>Use commas to add more than one company, region, or store scope.</small>
            </label>
          </section>

          <div className={styles.formNotice}><ShieldCheck aria-hidden="true" size={20} /><p><strong>Approval is controlled by the operator.</strong> Once saved, this vendor can be selected within its approved coverage. Secure service links do not require a portal account.</p></div>
          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Add approved vendor<ArrowRight aria-hidden="true" size={18} /></button></div>
        </form>
      ) : null}
    </div>
  );
}
