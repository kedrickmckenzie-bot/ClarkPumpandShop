"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, Check, FileCheck2, Mail, Search, Send, ShieldCheck, X } from "lucide-react";
import type { ApprovedLaterManagementViewModel } from "./data-contract";
import styles from "./enterprise-workspace.module.css";

type IssuanceStep = "vendor" | "review";

const deliveryOptions = [
  { value: "email", label: "Email-ready vendor link", helper: "Email dispatch and keep the secure response link on the record." },
  { value: "manual", label: "Manual handoff", helper: "Generate the secure link for phone, text, or another documented handoff." },
  { value: "print", label: "Print / PDF handoff", helper: "Generate the authorization for a printed or PDF handoff." },
] as const;

export function ApprovedLaterIssuanceDialog({ model }: { model: ApprovedLaterManagementViewModel }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<IssuanceStep>("vendor");
  const [query, setQuery] = useState("");
  const [vendorId, setVendorId] = useState(model.selectedVendorId ?? "");
  const [channel, setChannel] = useState<(typeof deliveryOptions)[number]["value"]>("email");
  const [message, setMessage] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);

  const vendors = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-US");
    if (!term) return model.vendors;
    return model.vendors.filter((vendor) => `${vendor.label} ${vendor.description}`.toLocaleLowerCase("en-US").includes(term));
  }, [model.vendors, query]);
  const selectedVendor = model.vendors.find((vendor) => vendor.value === vendorId);
  const selectedDelivery = deliveryOptions.find((option) => option.value === channel)!;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => (step === "vendor" ? searchRef.current : dialogTitleRef.current)?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, step]);

  function openDialog() {
    setStep("vendor");
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setStep("vendor");
  }

  return (
    <>
      <button className={styles.managementPrimary} type="button" onClick={openDialog} aria-haspopup="dialog" aria-expanded={open}>
        <Send aria-hidden="true" size={18} />
        <span><strong>Assign or send now</strong><small>Choose the vendor, review what they will receive, then send.</small></span>
      </button>

      <button className={styles.issuanceBackdrop} type="button" hidden={!open} onClick={closeDialog} aria-label="Close vendor assignment" />
      <section className={styles.issuanceDialog} role="dialog" aria-modal="true" aria-labelledby="approved-later-issuance-title" hidden={!open}>
        <header className={styles.issuanceDialogHeader}>
          <div>
            <span>Work order / service authorization</span>
            <h2 id="approved-later-issuance-title" ref={dialogTitleRef} tabIndex={-1}>Assign and send {model.workOrderNumber}</h2>
            <p>No change is made until you confirm the final Send action.</p>
          </div>
          <button type="button" onClick={closeDialog} aria-label="Close vendor assignment"><X aria-hidden="true" size={20} /></button>
        </header>

        <ol className={styles.issuanceSteps} aria-label="Assignment progress">
          <li data-active={step === "vendor" || undefined} data-complete={step === "review" || undefined}><span>{step === "review" ? <Check aria-hidden="true" size={14} /> : "1"}</span><div><strong>Choose vendor</strong><small>Provider and handoff method</small></div></li>
          <li data-active={step === "review" || undefined}><span>2</span><div><strong>Review and send</strong><small>Confirm the vendor copy</small></div></li>
        </ol>

        <div className={styles.issuanceDialogBody}>
          <section className={styles.issuanceChooseStep} hidden={step !== "vendor"} aria-label="Choose an approved vendor">
            <div className={styles.issuanceSectionHeading}>
              <div><small>Step 1</small><h3>Who should receive this work?</h3><p>Only approved vendors that cover this store are shown. Choose one provider; this is service work, not a request for bids.</p></div>
              <div className={styles.issuanceStoreContext}><Building2 aria-hidden="true" size={18} /><span><strong>{model.storeLabel}</strong><small>{model.storeAddress}</small></span></div>
            </div>

            <label className={styles.issuanceVendorSearch}>
              <span className={styles.visuallyHidden}>Search approved vendors</span>
              <Search aria-hidden="true" size={17} />
              <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vendor or service specialty" />
            </label>

            <div className={styles.issuanceVendorList} role="radiogroup" aria-label="Approved vendors">
              {vendors.length ? vendors.map((vendor) => (
                <label key={vendor.value} data-selected={vendorId === vendor.value || undefined}>
                  <input type="radio" name="issuanceVendorSelection" value={vendor.value} checked={vendorId === vendor.value} onChange={() => setVendorId(vendor.value)} />
                  <span className={styles.issuanceVendorMark}>{vendorId === vendor.value ? <Check aria-hidden="true" size={15} /> : null}</span>
                  <span><strong>{vendor.label}{vendor.preferred ? <em>Preferred</em> : null}</strong><small>{vendor.description}</small><small><Mail aria-hidden="true" size={13} />{vendor.dispatchEmail}</small></span>
                </label>
              )) : <p className={styles.issuanceNoVendors}>No approved vendors match that search.</p>}
            </div>

            <div className={styles.issuanceDeliveryGrid}>
              <label><span>Handoff method</span><select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}>{deliveryOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><small>{selectedDelivery.helper}</small></label>
              <label><span>Service note <small>Optional</small></span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Add access instructions or a short note for vendor dispatch." /></label>
            </div>
          </section>

          <section className={styles.issuanceReviewStep} hidden={step !== "review"} aria-label="Review service authorization">
            <div className={styles.issuanceSectionHeading}>
              <div><small>Step 2</small><h3>Review exactly what will be sent</h3><p>Confirm the vendor, store, work requested, and handoff method before creating the authorization.</p></div>
              <div className={styles.issuanceReadyBadge}><ShieldCheck aria-hidden="true" size={18} /><span><strong>Ready to send</strong><small>No vendor action exists yet</small></span></div>
            </div>

            <div className={styles.authorizationPreview}>
              <header><div><FileCheck2 aria-hidden="true" size={22} /><span><small>{model.organizationName}</small><strong>Work Order / Service Authorization</strong></span></div><strong>{model.workOrderNumber}</strong></header>
              <dl className={styles.authorizationParties}>
                <div><dt>Send to</dt><dd>{selectedVendor?.label ?? "Choose a vendor"}<small>{selectedVendor?.dispatchEmail}</small></dd></div>
                <div><dt>Service location</dt><dd>{model.storeLabel}<small>{model.storeAddress}</small></dd></div>
              </dl>
              <section><small>Problem reported</small><h4>{model.problem}</h4></section>
              <section><small>Work requested</small><p>{model.workScope}</p></section>
              <dl className={styles.authorizationFacts}>
                <div><dt>Service area</dt><dd>{model.categoryLabel}</dd></div>
                <div><dt>Equipment</dt><dd>{model.equipmentLabel ?? "No equipment record selected"}</dd></div>
                <div><dt>Priority</dt><dd>{model.priority.charAt(0).toUpperCase() + model.priority.slice(1)}</dd></div>
                <div><dt>Requested timing</dt><dd>{model.requestedTimingLabel ?? "Coordinate with customer"}</dd></div>
              </dl>
              {message ? <section><small>Service note</small><p>{message}</p></section> : null}
              <footer><strong>Billing reference</strong><span>Include operator work-order number {model.workOrderNumber} on service paperwork and invoices.</span><small>The vendor may accept, decline, propose a date, or ask a question from the secure response link.</small></footer>
            </div>

            <aside className={styles.issuanceInternalNote}><ShieldCheck aria-hidden="true" size={18} /><div><strong>Internal controls stay internal</strong><p>The invoice-review threshold and next-suitable-visit settings are not included in the vendor copy. Sending removes this job from the next-visit list only after the authorization is created.</p></div></aside>
          </section>
        </div>

        <footer className={styles.issuanceDialogFooter}>
          {step === "vendor" ? (
            <>
              <button type="button" onClick={closeDialog}>Cancel</button>
              <button className={styles.issuancePrimaryButton} type="button" disabled={!selectedVendor} onClick={() => setStep("review")}>Review before sending<Send aria-hidden="true" size={17} /></button>
            </>
          ) : (
            <form action={`/api/ops/work-orders/${encodeURIComponent(model.workOrderId)}/issue`} method="post">
              <input type="hidden" name="vendorId" value={vendorId} />
              <input type="hidden" name="channel" value={channel} />
              <input type="hidden" name="message" value={message} />
              <input type="hidden" name="expectedRevision" value={model.currentIssuanceRevision} />
              <button type="button" onClick={() => setStep("vendor")}><ArrowLeft aria-hidden="true" size={16} />Change vendor or details</button>
              <button className={styles.issuancePrimaryButton} type="submit">Send work order to {selectedVendor?.label ?? "vendor"}<Send aria-hidden="true" size={17} /></button>
            </form>
          )}
        </footer>
      </section>
    </>
  );
}
