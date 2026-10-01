import { SearchPicker } from "@/components/ops/search-picker";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { RecordForm } from "@/components/ops/record-form";
import styles from "@/components/workspace/warranty-center.module.css";
export default async function AddWarrantyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ component?: string }> }) {
  const session = await loadOperatorSession(); const { id } = await params; const query = await searchParams;
  if (!["executive", "facilities", "regional"].includes(session.role)) notFound();
  const repo = await getServerOpsRepository(); const asset = await repo.getAssetDetail(session, id);
  if (!asset) notFound();
  const vendors=await repo.listVendors(session,"",{limit:100});
  return <div className={styles.page}><header className={styles.header}><div><Link href={`/app/equipment/${id}#equipment-warranties`}>Back to equipment</Link><h1>Add warranty</h1><p>{asset.name} · {asset.assetTag}</p></div></header>
    <RecordForm action={`/api/ops/equipment/${encodeURIComponent(id)}/warranties`} className={`${styles.surface} ${styles.form}`}>
      <section className={styles.body}><div className={styles.grid}>
        <label className={styles.field}><span>Warranty type</span><select name="providerKind" required><option value="manufacturer">Manufacturer warranty</option><option value="vendor">Vendor work warranty</option></select></label>
        <label className={styles.field}><span>Equipment or component</span><select name="componentId" defaultValue={query.component ?? ""}><option value="">Entire equipment</option>{asset.components.map(c => <option value={c.id} key={c.id}>{c.name}{c.serialNumber ? ` · ${c.serialNumber}` : ""}</option>)}</select></label>
        <label className={styles.field}><span>Warranty name</span><input name="title" required maxLength={200} placeholder="Compressor parts coverage" /></label>
        <label className={styles.field}><span>Manufacturer or vendor name</span><input name="providerName" required maxLength={200} placeholder="Company providing coverage" /></label>
        <label className={styles.field}><span>Starts</span><input name="startDate" type="date" required /></label>
        <label className={styles.field}><span>Ends</span><input name="expirationDate" type="date" required /></label>
        <fieldset className={styles.coverageChoices}><legend>Costs covered</legend>{([['part','Parts'],['labor','Labor'],['travel','Travel'],['diagnostic','Diagnostics']] as const).map(([value,label])=><label key={value}><input type="checkbox" name="coveredCharges" value={value}/><span>{label}</span></label>)}</fieldset>

      </div><details><summary>More details (optional)</summary><div className={styles.form}><label><span>Contact <small>Optional</small></span><input name="administrator" maxLength={500} placeholder="Name, phone or email" /></label><SearchPicker name="vendorId" label="Vendor work provider (optional)" placeholder="Type a vendor name" allowClear clearLabel="No vendor linked" options={vendors.items.map(v=>({value:v.id,label:v.name}))}/><label className={styles.field}><span>Related work order <small>Optional</small></span><select name="workOrderId"><option value="">No linked work order</option>{asset.workOrders.map(w => <option key={w.id} value={w.id}>{w.number} · {w.problem}</option>)}</select></label>
      <label><span>Required repair provider <small>Optional</small></span><input name="authorizedProviderRule" maxLength={1000} placeholder="Any approved provider, original vendor, or authorized service" /></label>
      <label className={styles.field}><span>Limitations, exclusions or claim instructions <small>Optional</small></span><textarea name="claimRequirements" rows={2} maxLength={2000} /></label></div></details></section>
      <div className={styles.body}><p className={styles.muted}>You can attach documents and photos after saving.</p><div className={styles.actions}><Link className={styles.secondary} href={`/app/equipment/${id}`}>Cancel</Link><button className={styles.button} type="submit">Add warranty</button></div></div>
    </RecordForm></div>;
}
