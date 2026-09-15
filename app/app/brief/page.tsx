import styles from "@/components/workspace/brief-summary.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OwnerBriefSection } from "@/components/workspace/owner-brief";
import { CoverageQualitySection } from "@/components/workspace/coverage-quality";
import { loadCoverageQualityModel, loadOwnerBriefModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Owner brief" };

export default async function OwnerBriefPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  let brief;
  try { brief = await loadOwnerBriefModel(query); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return <div className={styles.page}><h1>Choose a valid brief period</h1><p>The start must be on or before the end.</p><Link href="/app/brief">Use the last 30 days</Link></div>;
  }
  const coverageQuality = await loadCoverageQualityModel();
  if (!brief && !coverageQuality) notFound();
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Owner brief</h1>
        <p className="brief-page-sub">Costs, work and decisions across your stores.</p>
      </header>
      {brief ? <OwnerBriefSection model={brief} /> : null}
      {coverageQuality ? <CoverageQualitySection model={coverageQuality} /> : null}
    </div>
  );
}
