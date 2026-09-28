"use client";

import { SavedWorkSuggestions } from "./saved-work-suggestions";
import { useWorkOrderScope } from "./work-order-scope";
import type { StoreVendorPage } from "@/lib/ops/store-vendors";
import { useEffect, useState } from "react";
import type { CreateWorkOrderPageViewModel } from "./data-contract";
import styles from "./ops.module.css";

export function WorkRoutingFields({ model, accountabilityOnly }: { model: CreateWorkOrderPageViewModel; accountabilityOnly: boolean }) {
  const { storeId } = useWorkOrderScope();
  const [route, setRoute] = useState<string>(accountabilityOnly && model.defaults?.assignmentKind === "hold_for_visit" ? "choose_later" : model.defaults?.assignmentKind ?? "choose_later");
  const [search, setSearch] = useState("");
  const [vendorId, setVendorId] = useState(model.defaults?.vendorId ?? "");
  const [storeVendors,setStoreVendors]=useState<{storeId:string;search:string;page:StoreVendorPage}|null>(null);
  const [vendorError,setVendorError]=useState("");
  const [offset,setOffset]=useState(0);
  useEffect(()=>{
    if(!storeId || route!=="outside_vendor")return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try { const response=await fetch(`/api/ops/stores/${encodeURIComponent(storeId)}/vendors?${new URLSearchParams({q:search.toLowerCase().replace(/gas pumps?/g,"dispenser").replace(/^gas$/,"fuel").replace(/card readers?/g,"payment terminal"),offset:String(offset)})}`,{signal:controller.signal});
        if(!response.ok)throw new Error("Could not load vendors for this store.");
        const page=await response.json() as StoreVendorPage;
        if(!controller.signal.aborted){setStoreVendors({storeId,search,page});setVendorError("");}
      }catch(error){if(!controller.signal.aborted)setVendorError(error instanceof Error?error.message:"Try again.");}
    },200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[storeId,route,search,offset]);
  const loaded=storeVendors?.storeId===storeId&&storeVendors.search===search;
  const available=storeId ? loaded ? storeVendors.page.items.filter(v=>v.covered).map(v=>({value:v.id,label:v.name,description:v.specialties.map(t=>t.label).join(", "),preference:v.preferenceKeys.length?`Preferred at this store${v.preferenceKeys.includes("*")?"":` for ${v.preferenceKeys.map(k=>v.specialties.find(t=>t.key===k)?.label??k).join(", ")}`}`:""})) : [] : model.vendors.map(v=>({...v,preference:""}));
  const vendors = storeId ? available : available.filter((vendor) => `${vendor.label} ${vendor.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase().replace(/gas pumps?/g, "dispenser").replace(/^gas$/, "fuel")));
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
      <label className={styles.field} htmlFor="vendor-search"><span>Find a vendor</span><input id="vendor-search" type="search" value={search} onChange={(event) => {setSearch(event.target.value);setOffset(0);}} placeholder="Name, specialty, equipment or coverage" /></label>
      {vendorError?<p role="alert">{vendorError}</p>:null}
      <p role="status">{storeId&&!loaded&&!vendorError?"Loading vendors…":vendors.length ? `${vendors.length} matching vendor${vendors.length === 1 ? "" : "s"}` : "No matching vendors. Try another search."}</p>
      <fieldset className={styles.assignmentChoices}>
        <legend>Service vendor · Required</legend>
        {available.filter((vendor) => vendors.includes(vendor) || vendor.value === vendorId).map((vendor) => <label key={vendor.value}>
          <input type="radio" name="vendorId" value={vendor.value} required checked={vendorId === vendor.value} onChange={() => setVendorId(vendor.value)} />
          <span><strong>{vendor.label}</strong>{vendor.preference?<small>{vendor.preference}</small>:null}{vendor.value === vendorId ? <small>Selected{!vendors.includes(vendor) ? " · outside this search" : ""}</small> : null}</span>
        </label>)}
      </fieldset>
      {loaded&&storeVendors.page.total>25?<div><button type="button" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous vendors</button><button type="button" disabled={offset+25>=storeVendors.page.total} onClick={()=>setOffset(offset+25)}>More vendors</button></div>:null}
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
