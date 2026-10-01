import { SearchPicker } from "@/components/ops/search-picker";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { ARRIVAL_TRADES } from "@/lib/ops/vendor-arrival-review";
import { RecordForm } from "@/components/ops/record-form";
import styles from "@/components/ops/ops.module.css";
import type { Metadata } from "next";
import { VendorPerformanceDetail, vendorTab } from "@/components/ops/vendor-performance-workspace";
import { loadOperatorSession, loadVendorPerformanceDetailModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const [model, session] = await Promise.all([
    loadVendorPerformanceDetailModel(id, query),
    loadOperatorSession(),
  ]);
  const vendor = await (await getServerOpsRepository()).getVendor(session.organizationId,id);
  const pending = vendor?.code.startsWith("vendor-arrival-") && vendor.status === "restricted";
  return <>{pending && vendor ? <section className={styles.arrivalReview}><h2>Company needs onboarding</h2><p>These details were entered at check-in. Review them before approving this company. The arrival remains recorded in visit history.</p>{model.coverageEditor ? <RecordForm action={`/api/ops/vendors/${encodeURIComponent(id)}/arrival-review`}><label className={styles.field}>Company name<input name="name" defaultValue={vendor.name} required maxLength={160}/></label><label className={styles.field}>Contact email<input name="email" type="email" defaultValue={vendor.dispatchEmail} required maxLength={254}/></label><label className={styles.field}>Contact phone<input name="phone" defaultValue={vendor.dispatchPhone} maxLength={60}/></label><label className={styles.field}>Service area<select name="trade" required><option value="">Choose service area</option>{Object.entries(ARRIVAL_TRADES).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><SearchPicker name="storeId" label="Approve for store" required placeholder="Store number or name" options={model.coverageEditor.stores.map(store=>({value:store.id,label:store.label}))}/><button type="submit" className={styles.primaryButton}>Approve vendor</button></RecordForm> : <p>Facilities must review this company.</p>}</section> : null}<VendorPerformanceDetail model={{ ...model, notice }} edition={session.demoEdition} tab={vendorTab(typeof query.tab === "string" ? query.tab : undefined)} /></>;

}
