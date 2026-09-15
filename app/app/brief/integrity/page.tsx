import type { Metadata } from "next";
import Link from "next/link";
import { BriefRecords } from "@/components/workspace/brief-records";
import styles from "@/components/workspace/brief-summary.module.css";
import { loadIntegrityRecordsModel } from "../../_data/operator-loader";
export const metadata: Metadata = { title: "Record checks" };
export default async function IntegrityRecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let model;
  try { model = await loadIntegrityRecordsModel(await searchParams); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return <div className={styles.page}><h1>Choose a record check</h1><Link href="/app/brief#record-checks">Return to the owner brief</Link></div>;
  }
  return <BriefRecords model={model} />;
}
