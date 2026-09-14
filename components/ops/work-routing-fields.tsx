"use client";

import { useState } from "react";
import type { CreateWorkOrderPageViewModel } from "./data-contract";
import styles from "./ops.module.css";

export function WorkRoutingFields({ model, accountabilityOnly }: { model: CreateWorkOrderPageViewModel; accountabilityOnly: boolean }) {
  const [route, setRoute] = useState<string>(model.defaults?.assignmentKind ?? "choose_later");
  const [search, setSearch] = useState("");
  const [vendorId, setVendorId] = useState(model.defaults?.vendorId ?? "");
  const vendors = model.vendors.filter((vendor) => vendor.value === vendorId || `${vendor.label} ${vendor.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const choices = [
    ...(!accountabilityOnly ? [{ id: "internal", label: "Internal maintenance" }] : []),
    { id: "outside_vendor", label: "Outside vendor" },
    { id: "choose_later", label: "Choose later" },
  ];
  return <>
    <fieldset className={styles.assignmentChoices}>
      <legend>Who will do the work?</legend>
      {choices.map((choice) => <label key={choice.id} htmlFor={`route-${choice.id}`} aria-label={choice.label}>
        <input id={`route-${choice.id}`} type="radio" name="assignmentKind" value={choice.id} checked={route === choice.id} onChange={() => setRoute(choice.id)} />
        <span><strong>{choice.label}</strong></span>
      </label>)}
    </fieldset>
    {!accountabilityOnly ? <details className={styles.optionalFormSection}>
      <summary><strong>Other service options</strong><span>Request quotes or approve for a future visit</span></summary>
      <fieldset className={styles.assignmentChoices}>
        <legend className={styles.visuallyHidden}>Other service options</legend>
        <label htmlFor="route-bid" aria-label="Request quotes first"><input id="route-bid" type="radio" name="assignmentKind" value="bid_request" checked={route === "bid_request"} onChange={() => setRoute("bid_request")} /><span><strong>Request quotes first</strong><small>Ask for pricing before authorizing work.</small></span></label>
        <label htmlFor="route-hold" aria-label="Approve for later"><input id="route-hold" type="radio" name="assignmentKind" value="hold_for_visit" checked={route === "hold_for_visit"} onChange={() => setRoute("hold_for_visit")} /><span><strong>Approve for later</strong><small>Offer this work during a suitable vendor visit.</small></span></label>
      </fieldset>
    </details> : null}
    {route === "outside_vendor" ? <div className={styles.fieldGrid}>
      <label className={styles.field} htmlFor="vendor-search"><span>Find a vendor</span><input id="vendor-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, specialty, equipment or coverage" /></label>
      <label className={styles.field} htmlFor="work-vendor"><span>Service vendor <em>Required</em></span>
        <select id="work-vendor" name="vendorId" required value={vendorId} onChange={(event) => setVendorId(event.target.value)}><option value="">Choose a vendor</option>{vendors.map((vendor) => <option key={vendor.value} value={vendor.value}>{vendor.label}</option>)}</select>
        {!vendors.length ? <small role="status">No matching vendors. Try a different search.</small> : null}
      </label>
    </div> : null}
    {route === "internal" ? <label className={styles.field} htmlFor="work-internal-assignee"><span>Internal assignee <em>Required</em></span><select id="work-internal-assignee" name="internalMembershipId" required defaultValue={model.defaults?.internalMembershipId ?? ""}><option value="">Choose a technician</option>{model.internalAssignees.map((member) => <option key={member.value} value={member.value}>{member.label}</option>)}</select><small>Choose a technician, or use Choose later.</small></label> : null}
    {route === "hold_for_visit" ? <div className={styles.fieldGrid}>
      <label className={styles.field}><span>What may the vendor do?</span><select name="holdPosture" defaultValue="complete_using_professional_judgment"><option value="complete_using_professional_judgment">Complete during the visit if practical</option><option value="look_and_report">Inspect and report back</option></select></label>
      <label className={styles.field}><span>Review by <em>Required</em></span><input name="holdDeadlineAt" type="datetime-local" required /></label>
      <label className={styles.field}><span>Invoice review threshold <small>Optional</small></span><input name="holdInternalReviewThreshold" type="number" min="0" step="0.01" inputMode="decimal" /><small>For internal review; not a vendor spending limit.</small></label>
    </div> : null}
  </>;
}
