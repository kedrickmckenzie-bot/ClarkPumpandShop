import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerBriefSection } from "@/components/workspace/owner-brief";
import { CoverageQualitySection } from "@/components/workspace/coverage-quality";
import { loadCoverageQualityModel, loadOwnerBriefModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Owner brief" };

export default async function OwnerBriefPage() {
  const [brief, coverageQuality] = await Promise.all([loadOwnerBriefModel(), loadCoverageQualityModel()]);
  if (!brief && !coverageQuality) notFound();
  return (
    <main className="brief-page">
      <header className="brief-page-head">
        <p className="brief-page-eyebrow">For owners and executives</p>
        <h1>Owner brief</h1>
        <p className="brief-page-sub">The last 30 days across your stores — what happened, what it cost, and what needs your decision. Every number opens the records behind it.</p>
      </header>
      {brief ? <OwnerBriefSection model={brief} /> : null}
      {coverageQuality ? <CoverageQualitySection model={coverageQuality} /> : null}
    </main>
  );
}