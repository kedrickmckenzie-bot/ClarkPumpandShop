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

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>3</span><div><h2>How is the store affected?</h2><p>Report what you can observe. Managers will confirm or revise this assessment before work is selected.</p></div></div>
            <div className={styles.fieldGrid}>
              <SelectField id="request-operating-state" name="storeOperatingState" label="Store operating state" required options={[
                { value: "open", label: "Open", description: "Normal operation continues" },
                { value: "partially_operational", label: "Partially operational", description: "A meaningful function or area is unavailable" },
                { value: "unable_to_operate", label: "Unable to operate", description: "The store cannot operate" },
                { value: "unknown", label: "Not sure", description: "Manager review is needed" },
              ]} />
              <SelectField id="request-safety" name="safetyConcern" label="Safety concern" required options={[
                { value: "none_reported", label: "None reported", description: "No safety concern observed" },
                { value: "potential", label: "Potential concern", description: "Needs timely review" },
                { value: "immediate", label: "Immediate concern", description: "Requires immediate response" },
                { value: "unknown", label: "Not sure", description: "Manager review is needed" },
              ]} />
              <SelectField id="request-inventory-risk" name="productInventoryRisk" label="Product or inventory risk" required options={[
                { value: "none_reported", label: "None reported", description: "No product risk observed" },
                { value: "at_risk", label: "Product at risk", description: "Loss may occur" },
                { value: "loss_reported", label: "Loss reported", description: "Store reports product loss" },
                { value: "unknown", label: "Not sure", description: "Manager review is needed" },
              ]} />
              <SelectField id="request-customers" name="customersAffected" label="Customers affected" required options={[
                { value: "yes", label: "Yes", description: "Customers are affected" },
                { value: "no", label: "No", description: "No customer impact observed" },
                { value: "unknown", label: "Not sure", description: "Manager review is needed" },
              ]} />
              <SelectField id="request-compliance" name="complianceImpact" label="Compliance impact" required options={[
                { value: "none_reported", label: "None reported", description: "No compliance concern observed" },
                { value: "potential", label: "Potential impact", description: "Needs review" },
                { value: "confirmed", label: "Confirmed impact", description: "A known requirement is affected" },
                { value: "unknown", label: "Not sure", description: "Manager review is needed" },
              ]} />
              <SelectField id="request-redundancy" name="redundantEquipment" label="Backup equipment available" required options={[
                { value: "yes", label: "Yes", description: "Backup capacity is available" },
                { value: "no", label: "No", description: "No redundant equipment" },
                { value: "unknown", label: "Not sure", description: "Manager review is needed" },
              ]} />
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="request-inventory-value"><span>Product value at risk <small>Optional · USD</small></span><input id="request-inventory-value" name="productInventoryValue" type="number" min="0" step="0.01" inputMode="decimal" /></label>
              <label className={styles.field} htmlFor="request-capacity"><span>Capacity unavailable <small>Optional · percent</small></span><input id="request-capacity" name="capacityUnavailablePercent" type="number" min="0" max="100" step="0.01" inputMode="decimal" /></label>
              <SelectField id="request-revenue-function" name="revenueFunctionImpact" label="Revenue function affected" options={[
                { value: "fuel", label: "Fuel", description: "Fuel sales or dispensing" },
                { value: "foodservice", label: "Foodservice", description: "Prepared food service" },
                { value: "refrigerated_merchandise", label: "Refrigerated merchandise", description: "Cold product sales" },
                { value: "beverages", label: "Beverages", description: "Packaged or fountain beverages" },
                { value: "lottery", label: "Lottery", description: "Lottery sales" },
                { value: "car_wash", label: "Car wash", description: "Car wash sales" },
                { value: "other", label: "Other", description: "Another store function" },
              ]} />
              <label className={styles.field} htmlFor="request-daily-exposure"><span>Estimated daily revenue exposure <small>Optional · USD</small></span><input id="request-daily-exposure" name="estimatedDailyRevenueExposure" type="number" min="0" step="0.01" inputMode="decimal" /></label>
              <label className={styles.field} htmlFor="request-downtime"><span>Estimated downtime <small>Optional · minutes</small></span><input id="request-downtime" name="estimatedDowntimeMinutes" type="number" min="0" step="1" inputMode="numeric" /></label>
              <SelectField id="request-confidence" name="confidence" label="Confidence in this report" required options={[
                { value: "low", label: "Low", description: "Facts are incomplete" },
                { value: "medium", label: "Medium", description: "Based on direct store observation" },
                { value: "high", label: "High", description: "Facts have been checked" },
              ]} />
            </div>
            <label className={styles.field} htmlFor="request-impact-notes"><span>Impact notes <small>Optional</small></span><textarea id="request-impact-notes" name="impactNotes" rows={3} placeholder="Add observed constraints, affected areas, or why an estimate is uncertain." /></label>
            <div className={styles.formNotice}><Info aria-hidden="true" size={19} /><p><strong>Estimates are planning context.</strong> Product value, revenue exposure, capacity, and downtime estimates are not verified losses.</p></div>
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
            <WorkOrderLifecycleFields assets={model.assetLifecycleInputs} asOf={model.lifecycleAsOf} defaultAssetId={model.defaults?.assetId} />
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>2</span><div><h2>Choose the service path</h2><p>Use a known provider, request pricing first, route internally, or decide later.</p></div></div>
            <fieldset className={styles.assignmentChoices}>
              <legend>Next step <span>Required</span></legend>
              <label htmlFor="assignment-internal" aria-label="Internal maintenance"><input id="assignment-internal" type="radio" name="assignmentKind" value="internal" required /><span><strong>Internal maintenance</strong><small>Assign to your own maintenance team.</small></span></label>
              <label htmlFor="assignment-vendor" aria-label="Send service work"><input id="assignment-vendor" type="radio" name="assignmentKind" value="outside_vendor" /><span><strong>Send service work</strong><small>Choose the vendor now, then send a service authorization. Technician check-in applies after it is issued.</small></span></label>
              <label htmlFor="assignment-bid" aria-label="Request vendor bids"><input id="assignment-bid" type="radio" name="assignmentKind" value="bid_request" /><span><strong>Request bids first</strong><small>Ask vendors for pricing by a due date. No vendor is assigned and no check-in is available.</small></span></label>
              <label htmlFor="assignment-later" aria-label="Decide later"><input id="assignment-later" type="radio" name="assignmentKind" value="choose_later" /><span><strong>Decide later</strong><small>Save the work order without choosing a provider or requesting bids yet.</small></span></label>
            </fieldset>
            <div className={styles.fieldGrid}>
              <label className={styles.field} htmlFor="work-vendor">
                <span>Service vendor <small>Required only for “Send service work”</small></span>
                <input id="work-vendor" name="vendorId" list="work-vendor-options" placeholder="Search name, specialty, equipment, or coverage" autoComplete="off" />
                <Datalist id="work-vendor-options" options={model.vendors} />
              </label>
              <SelectField id="work-internal-assignee" name="internalMembershipId" label="Internal assignee" options={model.internalAssignees} helper="Can be assigned after creation." />
            </div>
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeading}><span>3</span><div><h2>Add service details</h2><p>These fields apply to authorized service work. Bid requests use a separate pricing scope and response deadline.</p></div></div>
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

          <div className={styles.formNotice}><ShieldCheck aria-hidden="true" size={20} /><p><strong>A bid request and a service authorization are different records.</strong> Bid requests ask for numbers only. Service work is not authorized—and vendor check-in is not enabled—until a service authorization is deliberately sent.</p></div>
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
      <div className={styles.formSectionHeading}><span><Send aria-hidden="true" size={18} /></span><div><h2 id="issue-work-heading">Service path</h2><p>{model.helperText}</p></div></div>
      {!model.rolePermitted ? (
        <p className={styles.inlineEmpty}>Your role can review the service path but cannot send a service authorization.</p>
      ) : model.workflowBlocked ? (
        <p className={styles.inlineEmpty} role="status"><strong>Service path paused.</strong> {model.workflowBlockMessage}</p>
      ) : !model.permitted ? (
        <p className={styles.inlineEmpty}>Service authorization is unavailable while this work order is in its current state.</p>
      ) : (
        <details className={styles.controlDisclosure} open={!model.currentRevision}>
          <summary className={styles.controlDisclosureSummary}><Send aria-hidden="true" size={18} /><span><strong>{model.currentRevision ? `Prepare service-authorization revision ${model.currentRevision + 1}` : "Choose a vendor and prepare the service authorization"}</strong><small>This authorizes service. It is not a bid request.</small></span></summary>
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
                    <small>Locked to the vendor selected from the bid comparison.</small>
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
