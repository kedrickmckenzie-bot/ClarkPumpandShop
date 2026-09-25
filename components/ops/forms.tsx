import { StorePicker } from "./store-picker";
import Link from "next/link";
import { WorkRoutingFields } from "./work-routing-fields";
import { RecordForm } from "./record-form";
import { ArrowLeft, ArrowRight, Info, Route, Send } from "lucide-react";
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
import { WorkOrderScope, WorkOrderStore, WorkOrderEquipment } from "./work-order-scope";
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
        <RecordForm className={styles.recordForm} action={model.submitAction}>
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Where is the issue?</h2></div></div>
            <StorePicker initial={model.stores} defaultStoreId={model.defaultStoreId} searchable={model.storeLookup} initialCursor={model.storeNextCursor}/>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>What needs attention?</h2></div></div>
            <label className={styles.field} htmlFor="request-problem">
              <span>Problem <em>Required</em></span>
              <textarea id="request-problem" name="problem" required minLength={10} rows={4} placeholder="What is happening, and where?" />
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
            <SelectField id="request-priority" name="priority" label="Priority" required defaultValue="routine" options={model.priorityOptions} helper="Emergency: immediate safety risk or major disruption." />
          </section>

          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Submit request<ArrowRight aria-hidden="true" size={18} /></button></div>
        </RecordForm>
      ) : null}
    </div>
  );
}

export function CreateWorkOrderForm({ model, componentId, submissionKey = "work-order:test-render", edition = "complete" }: { model: CreateWorkOrderPageViewModel; componentId?: string; submissionKey?: string; edition?: DemoEdition }) {
  const accountabilityOnly = edition === "accountability";
  const boundStoreId = model.sourceRequest?.storeId ?? model.defaults?.storeId;

  const sourceVendorLabel = model.sourceVisit ? model.vendors.find((vendor) => vendor.value === model.defaults?.vendorId)?.label : undefined;
  const sourceInternalLabel = model.sourceVisit ? model.internalAssignees.find((member) => member.value === model.defaults?.internalMembershipId)?.label : undefined;
  return (
    <div className={styles.formPage}>
      <PageIntro model={model} />
      <ModelState state={model.state} />
      {model.state.kind === "ready" ? (
        <WorkOrderScope defaultStoreId={boundStoreId}><RecordForm className={styles.recordForm} action={model.submitAction}>
          <input type="hidden" name="submissionKey" value={submissionKey} />
          {model.sourceRequest ? <input type="hidden" name="requestId" value={model.sourceRequest.id} /> : null}
          {model.sourcePm ? <input type="hidden" name="pmOccurrenceId" value={model.sourcePm.occurrenceId} /> : null}
          {model.sourceVisit ? <input type="hidden" name="sourceExceptionId" value={model.sourceVisit.exceptionId} /> : null}
          {componentId ? <input type="hidden" name="componentId" value={componentId} /> : null}
          {componentId ? (
            <div className={styles.formNotice}>
              <Info aria-hidden="true" size={19} />
              <p><strong>Component-level work.</strong> Linked to the component you selected.</p>
            </div>
          ) : null}
          {model.sourceRequest ? (
            <div className={styles.formNotice}>
              <Info aria-hidden="true" size={19} />
              <p><strong>Converting {model.sourceRequest.reference}.</strong> Reported by {model.sourceRequest.reporterName} {model.sourceRequest.submittedLabel}. The original request remains in the audit trail.</p>
            </div>
          ) : null}
          {model.sourcePm ? (
            <div className={styles.formNotice}>
              <Info aria-hidden="true" size={19} />
              <p><strong>Creating work for {model.sourcePm.planName}.</strong> This {model.sourcePm.statusLabel.toLocaleLowerCase("en-US")} occurrence was due {model.sourcePm.dueLabel}. The PM occurrence stays linked.</p>
            </div>
          ) : null}
          {model.sourceVisit ? (
            <>
              <div className={styles.formNotice}>
                <Route aria-hidden="true" size={19} />
                <p><strong>Documenting work after service began.</strong> {model.sourceVisit.technicianName} from {model.sourceVisit.providerName} checked in {model.sourceVisit.checkedInLabel}{model.sourceVisit.checkedOutLabel ? ` and checked out ${model.sourceVisit.checkedOutLabel}` : ""}. Original times stay unchanged. This does not backdate authorization.</p>
              </div>
              {model.sourceVisit.outcomeNotes ? <div className={styles.formNotice}>
                <Info aria-hidden="true" size={19} />
                <p><strong>Technician checkout{model.sourceVisit.outcomeLabel ? ` · ${model.sourceVisit.outcomeLabel}` : ""}.</strong> {model.sourceVisit.outcomeNotes}</p>
              </div> : null}
            </>
          ) : null}
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Define the work</h2><p>Start with a store and a problem.</p></div></div>
            <WorkOrderStore model={model} locked={Boolean(model.sourceVisit || model.sourceRequest || model.sourcePm || componentId)} />
            <label className={styles.field} htmlFor="work-problem">
              <span>Problem <em>Required</em></span>
              <textarea id="work-problem" name="problem" rows={3} required placeholder="What needs to be inspected, repaired, or maintained?" defaultValue={model.sourceRequest?.problem ?? model.defaults?.problem} />
            </label>
            <SelectField id="work-priority" name="priority" label="Priority" required options={model.priorityOptions} defaultValue={model.defaults?.priority ?? "routine"} />
            {!accountabilityOnly ? (
              <details className={styles.optionalFormSection} open={Boolean(componentId || model.defaults?.assetId || model.defaults?.categoryKey)}>
                <summary><strong>Classify equipment</strong><span>Optional · add now or later</span></summary>
                <WorkOrderEquipment model={model} />
              </details>
            ) : null}
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>{model.sourceVisit ? "Confirm who performed the visit" : accountabilityOnly ? "Choose the vendor" : "Choose how to handle it"}</h2><p>{model.sourceVisit ? "Keep the provider recorded at check-in." : accountabilityOnly ? "Select a vendor now or choose one later." : "Assign now, decide later, or save for a suitable visit."}</p></div></div>
            {model.sourceVisit ? (
              <div className={styles.formNotice}>
                <Route aria-hidden="true" size={19} />
                <input type="hidden" name="assignmentKind" value={model.defaults?.assignmentKind} />
                {model.defaults?.vendorId ? <input type="hidden" name="vendorId" value={model.defaults.vendorId} /> : null}
                {model.defaults?.internalMembershipId ? <input type="hidden" name="internalMembershipId" value={model.defaults.internalMembershipId} /> : null}
                <p><strong>Provider preserved from check-in.</strong> {sourceVendorLabel ?? sourceInternalLabel ?? model.sourceVisit.providerName} stays assigned.</p>
              </div>
            ) : <WorkRoutingFields model={model} accountabilityOnly={accountabilityOnly} />}
          </section>

          <details className={`${styles.formSection} ${styles.optionalServiceSection}`}>
            <summary className={styles.formSectionHeading}><span>3</span><div><h2>{model.sourceVisit ? "Add what was requested" : "Add service details"}</h2><p>{model.sourceVisit ? "Optional notes about what was requested." : accountabilityOnly ? "Optional scope or requested service date." : "Optional scope, spending limit or due date."}</p></div></summary>
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

          {model.sourceVisit ? <p className={styles.formMeta}>Links this visit without backdating authorization.</p> : null}
          <div className={styles.formFooter}>
            <Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link>
            <button className={styles.primaryButton} type="submit" name="intent" value="save">{model.sourceVisit ? "Create and link work order" : "Create work order"}</button>
            {!model.sourceVisit ? <button className={`${styles.primaryButton} ${styles.sendConditional}`} type="submit" name="intent" value="create_and_send">Create and send to vendor<Send aria-hidden="true" size={18} /></button> : null}
          </div>
        </RecordForm></WorkOrderScope>
      ) : null}
    </div>
  );
}

export function VendorIssuancePanel({ model, edition = "complete" }: { model: VendorIssuanceViewModel; edition?: DemoEdition }) {
  if (!model.available) return null;
  const accountabilityOnly = edition === "accountability";
  return (
    <section className={styles.issuancePanel} id="issue-work" aria-labelledby="issue-work-heading">
      <div className={styles.formSectionHeading}><span><Send aria-hidden="true" size={18} /></span><div><h2 id="issue-work-heading">{accountabilityOnly ? "Send work order" : "Service path"}</h2><p>{accountabilityOnly ? "Choose the vendor and generate the account-free work-order link they will receive." : "Create a secure authorization link. Email sends only when configured; SMS delivery is not connected."}</p></div></div>
      {!model.rolePermitted ? (
        <p className={styles.inlineEmpty}>Your role can review the service path but cannot send a service authorization.</p>
      ) : model.workflowBlocked ? (
        <p className={styles.inlineEmpty} role="status"><strong>Service path paused.</strong> {model.workflowBlockMessage}</p>
      ) : !model.permitted ? (
        <p className={styles.inlineEmpty}>Service authorization is unavailable while this work order is in its current state.</p>
      ) : (
        <details className={styles.controlDisclosure} open={!model.currentRevision}>
          <summary className={styles.controlDisclosureSummary}><Send aria-hidden="true" size={18} /><span><strong>{model.currentRevision ? `Prepare service-authorization revision ${model.currentRevision + 1}` : "Choose a vendor and prepare the service authorization"}</strong><small>{accountabilityOnly ? "This sends the vendor work order and enables technician check-in." : "This authorizes service. It is not a quote request."}</small></span></summary>
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
                    <small>{accountabilityOnly ? "Current vendor selection; later changes remain auditable." : "Locked to the vendor selected from the quote comparison."}</small>
                  </>
                ) : (
                  <select id="issuance-vendor" name="vendorId" required defaultValue={model.selectedVendorId ?? ""}>
                    <option value="" disabled>Select an approved vendor</option>
                    {model.vendors.map((vendor) => <option value={vendor.value} key={vendor.value}>{vendor.label}</option>)}
                  </select>
                )}
              </label>
              <SelectField id="issuance-channel" name="channel" label="Handoff method" required options={model.channels} defaultValue={model.channels[0]?.value} />
            </div>
            <label className={styles.field} htmlFor="issuance-message">
              <span>Service note <small>Optional</small></span>
              <textarea id="issuance-message" name="message" rows={3} placeholder="Add access instructions, preferred arrival times, or other details for the vendor." />
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
        <RecordForm className={styles.recordForm} action={model.submitAction}>
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Store identity</h2><p>Use the store’s everyday name and number.</p></div></div>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="store-number"><span>Store number <em>Required</em></span><input id="store-number" name="storeNumber" required autoComplete="off" /></label>
              <label className={styles.field} htmlFor="store-name"><span>Store name <em>Required</em></span><input id="store-name" name="name" required autoComplete="organization" /></label>
            </div>
            <label className={styles.field} htmlFor="store-aliases"><span>Search aliases <small>Optional</small></span><input id="store-aliases" name="aliases" placeholder="Former number, neighborhood, or commonly used name" /><small>Separate other names or old numbers with commas.</small></label>
            <SelectField id="store-region" name="regionId" label="Region" options={model.regions} helper="You can choose a region later." />
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>Location</h2><p>Enter the service address.</p></div></div>
            <label className={styles.field} htmlFor="store-address-1"><span>Address line 1 <em>Required</em></span><input id="store-address-1" name="address1" required autoComplete="address-line1" /></label>
            <label className={styles.field} htmlFor="store-address-2"><span>Address line 2 <small>Optional</small></span><input id="store-address-2" name="address2" autoComplete="address-line2" /></label>
            <div className={styles.addressGrid}>
              <label className={styles.field} htmlFor="store-city"><span>City <em>Required</em></span><input id="store-city" name="city" required autoComplete="address-level2" /></label>
              <label className={styles.field} htmlFor="store-state"><span>State <em>Required</em></span><input id="store-state" name="state" required maxLength={2} autoComplete="address-level1" /></label>
              <label className={styles.field} htmlFor="store-postal"><span>Postal code <em>Required</em></span><input id="store-postal" name="postalCode" required autoComplete="postal-code" /></label>
            </div>
            <SelectField id="store-timezone" name="timeZone" label="Store time zone" options={model.timeZones} defaultValue={model.defaultTimeZone} required helper="Used for visits, appointments and deadlines." />
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>3</span><div><h2>Visit evidence policy</h2><p>Optional location checks at arrival and departure only.</p></div></div>
            <label className={styles.checkField} htmlFor="store-location-policy" aria-label="Check location at arrival and departure"><input id="store-location-policy" type="checkbox" name="locationPolicyEnabled" value="true" /><span><strong>Check location at arrival and departure</strong><small>Technicians can still use a trusted store device when location is unavailable.</small></span></label>
            <label className={styles.field} htmlFor="store-geofence"><span>Location radius (meters) <small>Optional</small></span><input id="store-geofence" name="geofenceRadiusM" type="number" min="25" max="2000" step="5" /><small>Distance allowed from the store. Configure after verifying the address.</small></label>
          </section>


          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Create store<ArrowRight aria-hidden="true" size={18} /></button></div>
        </RecordForm>
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
        <RecordForm className={styles.recordForm} action={model.submitAction}>
          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>1</span><div><h2>Vendor profile</h2></div></div>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="vendor-name"><span>Vendor name <em>Required</em></span><input id="vendor-name" name="name" required autoComplete="organization" /></label>
              <label className={styles.field} htmlFor="vendor-code"><span>Vendor code <small>Optional</small></span><input id="vendor-code" name="code" autoComplete="off" /></label>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="vendor-email"><span>Dispatch email <em>Required</em></span><input id="vendor-email" name="dispatchEmail" type="email" required autoComplete="email" /></label>
              <label className={styles.field} htmlFor="vendor-phone"><span>Dispatch phone <small>Optional</small></span><input id="vendor-phone" name="dispatchPhone" type="tel" autoComplete="tel" /></label>
            </div>
            <label className={styles.checkField} htmlFor="vendor-preferred" aria-label="Preferred vendor"><input id="vendor-preferred" type="checkbox" name="preferred" value="true" /><span><strong>Preferred vendor</strong><small>Prioritize this vendor in search.</small></span></label>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>What they service</h2></div></div>
            <fieldset className={styles.choiceFieldset}><legend>Specialties <span>Choose one or more</span></legend><div className={styles.fieldGrid}>
              {model.specialties.map(option=><label className={styles.checkField} key={option.value}><input type="checkbox" name="specialtyKeys" value={option.value}/><span>{option.label}</span></label>)}
            </div></fieldset>
            <label className={styles.field} htmlFor="vendor-other-specialties"><span>Other specialties <small>Optional</small></span><input id="vendor-other-specialties" name="specialtyKeys" placeholder="For example, glass repair"/><small>Separate multiple specialties with commas.</small></label>
            <label className={styles.field} htmlFor="vendor-aliases"><span>Search aliases <small>Optional</small></span><input id="vendor-aliases" name="searchAliases" placeholder="Plumber, beer cave, walk-in, pumps, canopy lights" /><small>Aliases help managers find the right vendor using ordinary language.</small></label>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>3</span><div><h2>Where they work</h2></div></div>
            <fieldset className={styles.choiceFieldset}><legend>Coverage <span>Choose one or more</span></legend><div className={styles.fieldGrid}>
              {model.coverageScopes.map(option=><label className={styles.checkField} key={option.value}><input type="checkbox" name="coverageScopeIds" value={option.value}/><span>{option.label}</span></label>)}
            </div></fieldset>
          </section>

          <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelLink.href}>Cancel</Link><button className={styles.primaryButton} type="submit">Add approved vendor<ArrowRight aria-hidden="true" size={18} /></button></div>
        </RecordForm>
      ) : null}
    </div>
  );
}
