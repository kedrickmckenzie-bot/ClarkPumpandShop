import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/workspace/brief-summary.module.css";
import { BriefRecords } from "@/components/workspace/brief-records";
import { loadBriefRecordsModel } from "../../_data/operator-loader";
export const metadata: Metadata = { title: "Brief records" };
export default async function BriefRecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  let model;
  try { model = await loadBriefRecordsModel(query); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return <div className={styles.page}><h1>Choose valid brief filters</h1><p>{error.message}</p><Link href="/app/brief">Return to the owner brief</Link></div>;
  }
  return <BriefRecords model={model} />;
}
