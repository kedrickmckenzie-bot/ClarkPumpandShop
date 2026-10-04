"use client";

import { InternalAssignmentFields } from "@/components/workspace/internal-assignment-fields";
import { SavedWorkSuggestions } from "./saved-work-suggestions";
import { useWorkOrderScope } from "./work-order-scope";
import type { StoreVendorPage } from "@/lib/ops/store-vendors";
import { useCallback, useState } from "react";
import { SearchPicker, type PickOption, type PickPage } from "./search-picker";

const VENDOR_PAGE = 25;

/** One page of store vendors for the picker; `next` is the following offset while more remain. */
export function storeVendorPickPage(page: StoreVendorPage, offset: number): PickPage {
  const reached = offset + VENDOR_PAGE;
  return {
    items: page.items.filter((v) => v.covered).map((v) => ({ value: v.id, label: v.name, detail: v.specialties.slice(0, 3).map((t) => t.label).join(", "), tag: v.preferenceKeys.length ? "Preferred" : undefined })),
    next: reached < page.total ? String(reached) : undefined,
  };
}
import type { CreateWorkOrderPageViewModel } from "./data-contract";
import styles from "./ops.module.css";

export function WorkRoutingFields({ model, accountabilityOnly }: { model: CreateWorkOrderPageViewModel; accountabilityOnly: boolean }) {
  const { storeId } = useWorkOrderScope();
  const [route, setRoute] = useState<string>(accountabilityOnly && model.defaults?.assignmentKind === "hold_for_visit" ? "choose_later" : model.defaults?.assignmentKind ?? "choose_later");
  const [internalNextVisit, setInternalNextVisit] = useState(false);
  const [vendorId, setVendorId] = useState(model.defaults?.vendorId ?? "");
  // Vendors that cover the chosen store, narrowed on the server as you type.
  const loadVendors = useCallback(async (query: string, signal: AbortSignal, cursor?: string): Promise<PickPage> => {
    const q = query.toLowerCase().replace(/gas pumps?/g, "dispenser").replace(/^gas$/, "fuel").replace(/card readers?/g, "payment terminal");
    const offset = Number(cursor ?? 0);
    const response = await fetch(`/api/ops/stores/${encodeURIComponent(storeId)}/vendors?${new URLSearchParams({ q, offset: String(offset) })}`, { signal });
    if (!response.ok) throw new Error("Could not load vendors for this store.");
    const page = await response.json() as StoreVendorPage;
    return storeVendorPickPage(page, offset);
  }, [storeId]);
  const vendorOptions: PickOption[] = model.vendors.map((v) => ({ value: v.value, label: v.label, detail: v.description }));
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
      <SearchPicker key={storeId || "no-store"} name="vendorId" label="Service vendor" required placeholder="Name, specialty, equipment or coverage"
        options={storeId ? undefined : vendorOptions} load={storeId ? loadVendors : undefined}
        defaultValue={vendorId || undefined} defaultOption={vendorOptions.find((v) => v.value === vendorId)}
        emptyText="No vendor covering this store matches. Try fewer letters." onSelect={(vendor) => setVendorId(vendor?.value ?? "")} />
      {!accountabilityOnly ? <SavedWorkSuggestions storeId={storeId} vendorId={vendorId} preview /> : null}
    </div> : null}
    {route === "internal" ? <div className={styles.fieldGrid}>
      <InternalAssignmentFields storeId={storeId} defaultTarget={model.defaults?.internalMembershipId ? "person" : "pool"} defaultPerson={model.defaults?.internalMembershipId ? {id:model.defaults.internalMembershipId,name:model.internalAssignees.find(p=>p.value===model.defaults?.internalMembershipId)?.label??"Technician"} : undefined}/>
      <label className={styles.checkField}><input name="internalNextVisit" type="checkbox" onChange={e => setInternalNextVisit(e.target.checked)}/>Do on next visit</label>
      {internalNextVisit ? <label className={styles.field}><span>Review by <em>Required</em></span><input name="holdDeadlineAt" type="datetime-local" required/></label> : null}
    </div> : null}
    {route === "hold_for_visit" ? <div className={styles.fieldGrid}>
      <label className={styles.field}><span>Service category <em>Required</em></span><select name="holdCategoryKey" required defaultValue={model.defaults?.categoryKey ?? ""}><option value="">Choose a category</option>{model.categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><small>Used to group compatible jobs.</small></label>
      <label className={styles.field}><span>What may the vendor do?</span><select name="holdPosture" defaultValue="complete_using_professional_judgment"><option value="complete_using_professional_judgment">Complete during the visit if practical</option><option value="look_and_report">Inspect and report back</option></select></label>
      <label className={styles.field}><span>Review by <em>Required</em></span><input name="holdDeadlineAt" type="datetime-local" required /></label>
      <label className={styles.field}><span>Invoice review threshold <small>Optional</small></span><input name="holdInternalReviewThreshold" type="number" min="0" step="0.01" inputMode="decimal" /><small>For internal review; not a vendor spending limit.</small></label>
    </div> : null}
  </>;
}
