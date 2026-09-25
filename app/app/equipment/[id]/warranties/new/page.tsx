import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { RecordForm } from "@/components/ops/record-form";
import styles from "@/components/ops/ops.module.css";
export default async function AddWarrantyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ component?: string }> }) {
  const session = await loadOperatorSession(); const { id } = await params; const query = await searchParams;
  if (!["executive", "facilities", "regional"].includes(session.role)) notFound();
  const repo = await getServerOpsRepository(); const asset = await repo.getAssetDetail(session, id);
  if (!asset) notFound();
  return <div className={styles.formPage}><header className={styles.formPageHeader}><Link href={`/app/equipment/${id}#equipment-warranties`}>Back to equipment</Link><h1>Add warranty</h1><p>{asset.name} · {asset.assetTag}</p></header>
    <RecordForm action={`/api/ops/equipment/${encodeURIComponent(id)}/warranties`} className={styles.recordForm}>
      <section className={styles.formSection}><div className={styles.fieldGrid}>
        <label className={styles.field}><span>Warranty type</span><select name="providerKind" required><option value="manufacturer">Manufacturer warranty</option><option value="vendor">Vendor work warranty</option></select></label>
        <label className={styles.field}><span>Covers</span><select name="componentId" defaultValue={query.component ?? ""}><option value="">Whole equipment</option>{asset.components.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
        <label className={styles.field}><span>Warranty name</span><input name="title" required maxLength={200} placeholder="Compressor parts coverage" /></label>
        <label className={styles.field}><span>Manufacturer or vendor name</span><input name="providerName" required maxLength={200} placeholder="Company providing coverage" /></label>
        <label className={styles.field}><span>Starts</span><input name="startDate" type="date" required /></label>
        <label className={styles.field}><span>Ends</span><input name="expirationDate" type="date" required /></label>
        <label className={styles.field}><span>Parts coverage</span><input name="partsCoverage" required maxLength={1000} placeholder="Covered, excluded, or specific terms" /></label>
        <label className={styles.field}><span>Labor coverage</span><input name="laborCoverage" required maxLength={1000} placeholder="Covered, excluded, or specific terms" /></label>
      </div><label className={styles.field}><span>Related work order <small>Optional</small></span><select name="workOrderId"><option value="">No linked work order</option>{asset.workOrders.map(w => <option key={w.id} value={w.id}>{w.number} · {w.problem}</option>)}</select></label>
      <label className={styles.field}><span>Claim instructions or exclusions <small>Optional</small></span><textarea name="claimRequirements" rows={2} maxLength={2000} /></label></section>
      <div className={styles.formFooter}><Link className={styles.secondaryButton} href={`/app/equipment/${id}`}>Cancel</Link><button className={styles.primaryButton} type="submit">Add warranty</button></div>
    </RecordForm></div>;
}
