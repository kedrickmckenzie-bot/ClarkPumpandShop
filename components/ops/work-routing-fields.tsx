"use client";

import { SavedWorkSuggestions } from "./saved-work-suggestions";
import { useWorkOrderScope } from "./work-order-scope";
import { useState } from "react";
import type { CreateWorkOrderPageViewModel } from "./data-contract";
import styles from "./ops.module.css";

export function WorkRoutingFields({ model, accountabilityOnly }: { model: CreateWorkOrderPageViewModel; accountabilityOnly: boolean }) {
  const { storeId } = useWorkOrderScope();
  const [route, setRoute] = useState<string>(accountabilityOnly && model.defaults?.assignmentKind === "hold_for_visit" ? "choose_later" : model.defaults?.assignmentKind ?? "choose_later");
  const [search, setSearch] = useState("");
  const [vendorId, setVendorId] = useState(model.defaults?.vendorId ?? "");
  const vendors = model.vendors.filter((vendor) => `${vendor.label} ${vendor.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase().replace(/gas pumps?/g, "dispenser").replace(/^gas$/, "fuel")));
  const choices = [
    ...(!accountabilityOnly ? [{ id: "internal", label: "Internal maintenance" }] : []),
    { id: "outside_vendor", label: "Outside vendor" },
    { id: "choose_later", label: "Choose later" },
    ...(!accountabilityOnly ? [{ id: "hold_for_visit", label: "Save for a later visit" }] : []),
  ];
  return <>
    <fieldset className={styles.assignmentChoices}>
      <legend>How should we handle it?</legend>
      {choices.map((choice) => <label key={choice.id} htmlFor={`route-${choice.id}`} aria-label={choice.label}>
        <input id={`route-${choice.id}`} type="radio" name="assignmentKind" value={choice.id} checked={route === choice.id} onChange={() => setRoute(choice.id)} />
        <span><strong>{choice.label}</strong>{choice.id === "hold_for_visit" ? <small>Group small jobs at this store for one suitable visit.</small> : null}</span>
      </label>)}
    </fieldset>
    {!accountabilityOnly ? <details className={styles.optionalFormSection}>
      <summary><strong>Other service options</strong><span>Request pricing before assigning work</span></summary>
      <fieldset className={styles.assignmentChoices}>
        <legend className={styles.visuallyHidden}>Other service options</legend>
        <label htmlFor="route-bid" aria-label="Request quotes first"><input id="route-bid" type="radio" name="assignmentKind" value="bid_request" checked={route === "bid_request"} onChange={() => setRoute("bid_request")} /><span><strong>Request quotes first</strong><small>Ask for pricing before authorizing work.</small></span></label>
      </fieldset>
    </details> : null}
    {route === "outside_vendor" ? <div>
      <label className={styles.field} htmlFor="vendor-search"><span>Find a vendor</span><input id="vendor-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, specialty, equipment or coverage" /></label>
      <p role="status">{vendors.length ? `${vendors.length} matching vendor${vendors.length === 1 ? "" : "s"}` : "No matching vendors. Try another search."}</p>
      <fieldset className={styles.assignmentChoices}>
        <legend>Service vendor · Required</legend>
        {model.vendors.filter((vendor) => vendors.includes(vendor) || vendor.value === vendorId).map((vendor) => <label key={vendor.value}>
          <input type="radio" name="vendorId" value={vendor.value} required checked={vendorId === vendor.value} onChange={() => setVendorId(vendor.value)} />
          <span><strong>{vendor.label}</strong>{vendor.value === vendorId ? <small>Selected{!vendors.includes(vendor) ? " · outside this search" : ""}</small> : null}</span>
        </label>)}
      </fieldset>
      {!accountabilityOnly ? <SavedWorkSuggestions storeId={storeId} vendorId={vendorId} preview /> : null}
    </div> : null}
    {route === "internal" ? <label className={styles.field} htmlFor="work-internal-assignee"><span>Internal assignee <em>Required</em></span><select id="work-internal-assignee" name="internalMembershipId" required defaultValue={model.defaults?.internalMembershipId ?? ""}><option value="">Choose a technician</option>{model.internalAssignees.map((member) => <option key={member.value} value={member.value}>{member.label}</option>)}</select><small>Choose a technician, or use Choose later.</small></label> : null}
    {route === "hold_for_visit" ? <div className={styles.fieldGrid}>
      <label className={styles.field}><span>Service category <em>Required</em></span><select name="holdCategoryKey" required defaultValue={model.defaults?.categoryKey ?? ""}><option value="">Choose a category</option>{model.categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><small>Used to group compatible jobs.</small></label>
      <label className={styles.field}><span>What may the vendor do?</span><select name="holdPosture" defaultValue="complete_using_professional_judgment"><option value="complete_using_professional_judgment">Complete during the visit if practical</option><option value="look_and_report">Inspect and report back</option></select></label>
      <label className={styles.field}><span>Review by <em>Required</em></span><input name="holdDeadlineAt" type="datetime-local" required /></label>
      <label className={styles.field}><span>Invoice review threshold <small>Optional</small></span><input name="holdInternalReviewThreshold" type="number" min="0" step="0.01" inputMode="decimal" /><small>For internal review; not a vendor spending limit.</small></label>
    </div> : null}
  </>;
}
