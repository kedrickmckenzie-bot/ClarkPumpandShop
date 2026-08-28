import Link from "next/link";
import type { StoreSweepPlannerModel } from "@/app/app/_data/store-sweep-loader";
import styles from "./store-sweep-planner.module.css";

function localInputValue(value: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function StoreSweepPlanner({ model, notice }: { model: StoreSweepPlannerModel; notice?: string }) {
  const selectedStore = model.selectedStore;
  const planningBaseline = Date.parse(model.planningBaseline);
  const respondBy = selectedStore ? localInputValue(new Date(planningBaseline + 3 * 86_400_000), selectedStore.timeZone) : "";
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Work · Approved for later</p><h1>Group approved jobs</h1><p>Offer several already-approved jobs at one store to the same vendor. The vendor chooses when to visit and how to run the work. Every job keeps its own work-order number, result, cost, and invoice history.</p></div>
      <Link className={styles.secondaryButton} href="/app/work-orders?visitPlan=ready">Back to approved jobs</Link>
    </header>
    {notice ? <p className={styles.notice}>{notice}</p> : null}
    <section className={styles.summary} aria-label="Approved jobs waiting to be handled later">
      <div><span>Stores with approved jobs</span><strong>{model.stores.length}</strong></div>
      <div><span>Approved jobs waiting to be grouped</span><strong>{model.stores.reduce((sum, store) => sum + store.readyCount, 0)}</strong></div>
      <div><span>Jobs at selected store</span><strong>{selectedStore?.readyCount ?? 0}</strong></div>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>1. Choose the store</h2><p>Stores with the most approved small jobs appear first.</p></div></div>
      <form className={styles.storePicker} action="/app/store-sweeps/new" method="get">
        <label><span>Store</span><select name="store" defaultValue={model.selectedStoreId}>{model.stores.map((store) => <option key={store.id} value={store.id}>{store.label} · {store.readyCount} approved {store.readyCount === 1 ? "job" : "jobs"}</option>)}</select></label>
        <button type="submit">Show this store</button>
      </form>
    </section>
    {selectedStore ? <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>2. Choose a vendor and the jobs to group</h2><p>{selectedStore.label} has {selectedStore.readyCount} approved {selectedStore.readyCount === 1 ? "job" : "jobs"} that can wait. {model.focusedWorkOrderId ? "The job you opened is selected first; add any other work this vendor should handle." : "Different service areas can be offered to different vendors."}</p></div></div>
      {model.vendorOptions.length ? <div className={styles.vendorList}>{model.vendorOptions.map((vendor) => <form className={styles.vendorCard} action="/api/ops/store-sweeps" method="post" key={vendor.vendorId}>
        <input type="hidden" name="storeId" value={selectedStore.id} />
        <input type="hidden" name="vendorId" value={vendor.vendorId} />
        <input type="hidden" name="contractVersionId" value={vendor.contractVersionId} />
        <div className={styles.vendorHeader}><div><p className={styles.eyebrow}>Vendor</p><h3>{vendor.vendorName}</h3><p>{vendor.serviceAreas.join(" · ")}</p></div><span className={styles.count}>{vendor.jobs.length} {vendor.jobs.length === 1 ? "job" : "jobs"} in these service areas</span></div>
        <p className={styles.explainer}>Shown because this company’s vendor record lists these service areas. This does not certify an individual technician; the vendor decides what its crew can complete.</p>
        <fieldset className={styles.jobList}><legend>Select approved jobs</legend>{vendor.jobs.map((job) => <label className={styles.job} key={job.workOrderId}>
          <input aria-label={`Include ${job.number}: ${job.problem}`} type="checkbox" name="workOrderId" value={job.workOrderId} defaultChecked={!model.focusedWorkOrderId || job.workOrderId === model.focusedWorkOrderId} />
          <span><span className={styles.jobTitle}>{job.number} · {job.problem}</span><span className={styles.jobMeta}>{job.serviceArea} · {job.posture} · {job.reviewLabel}</span><span className={styles.scope}>{job.scope}</span></span>
        </label>)}</fieldset>
        <div className={styles.scheduleGrid}>
          <label><span>Ask the vendor to respond by</span><input required name="responseDueAt" type="datetime-local" defaultValue={respondBy} /></label>
          <div style={{ display: "grid", gap: 6, fontSize: 14, fontWeight: 700 }}><span>Earliest review date</span><strong style={{ fontSize: 16 }}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: selectedStore.timeZone }).format(new Date(vendor.earliestReviewAt))}</strong><small>The final request inherits the earliest date from the jobs you select. You do not schedule the vendor.</small></div>
          <label className={styles.wide}><span>Store access notes (optional)</span><textarea name="accessRequirements" rows={2} maxLength={500} placeholder="Example: check in at the front counter; avoid the lunch rush." /></label>
        </div>
        <div className={styles.actions}><p>No savings amount is created by grouping jobs. The vendor supplies the visit date; results are recorded separately for every job.</p><button type="submit">Group jobs for vendor</button></div>
      </form>)}</div> : <div className={styles.empty}><h3>No vendor is ready for these service areas</h3><p>Review the vendor’s service areas, store coverage, work terms, and required documents before planning a combined visit.</p></div>}
    </section> : <section className={styles.empty}><h2>No work is approved for later</h2><p>Use “Approve for later” on a low-priority job. It will appear here until it is grouped with other work or sent separately.</p></section>}
  </div>;
}
