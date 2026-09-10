import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { SetupActions } from "@/components/ops/setup-forms";
import { DetailView } from "@/components/ops/views";
import { AssetReplacementIntelligencePanel } from "@/components/ops/replacement-intelligence-panel";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { loadDetailModel, loadOperatorSession } from "../../_data/operator-loader";
import { loadAssetReplacementIntelligenceModel } from "../../_data/replacement-loader";
import { buildEquipmentReview } from "../../_data/equipment-review";
import { EquipmentReview } from "@/components/workspace/equipment-review";

export const metadata: Metadata = { title: "Equipment detail" };

export default async function EquipmentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const session = await loadOperatorSession();
  const [model, fixture, replacement] = await Promise.all([
    loadDetailModel("equipment", id),
    getRequestOpsFixtureSnapshot(session.organizationId),
    loadAssetReplacementIntelligenceModel(id),
  ]);
  const asset = fixture.assets.find((item) => item.organizationId === session.organizationId && item.id === id);
  const review = buildEquipmentReview(fixture, session, id, query);
  if (asset) model.facts.splice(4, 0, { label: "Supplier", value: asset.supplier ?? "Not entered" });
  const componentSection = model.sections.find((section) => section.id === "components");
  if (componentSection?.table) {
    componentSection.table.rows = componentSection.table.rows.map((row) => ({
      ...row,
      href: `/app/equipment/${encodeURIComponent(id)}/components/${encodeURIComponent(row.id)}`,
    }));
    if (roleCan(session, "setup_equipment")) {
      componentSection.action = { label: "Add component", href: `/app/equipment/${encodeURIComponent(id)}/components/new` };
    }
  }
  if (review) {
    // The connected workspace owns history/components now; keep setup and PM sections.
    model.sections = model.sections.filter((section) => !["service-history", "components", "lifecycle-evidence"].includes(section.id));
    if (review.currentWork.length) model.page.primaryAction = review.currentWork.length === 1
      ? { label: "Continue existing work", href: review.currentWork[0].href }
      : { label: "Review existing work", href: "#equipment-review" };
  }
  const canSetupEquipment = roleCan(session, "setup_equipment");
  const canSetupPm = roleCan(session, "setup_pm");
  const storeId = model.facts.find((fact) => fact.label === "Store")?.link?.href.split("/").at(-1);
  return (
    <DetailView
      model={model}
      initialSection="overview"
      beforeSections={<>{review ? <EquipmentReview model={review} /> : null}{replacement ? <details><summary>Whole-equipment repair and replacement planning</summary><AssetReplacementIntelligencePanel model={replacement} /></details> : null}</>}
      after={canSetupEquipment || canSetupPm ? <SetupActions
          title="Build out this equipment record"
          description="Add component depth or schedule preventive work. Both features stay optional and connect back to this equipment history."
          actions={[
            ...(canSetupEquipment
              ? [{ label: "Add component", href: `/app/equipment/${encodeURIComponent(id)}/components/new`, icon: "component" as const }]
              : []),
            ...(canSetupPm
              ? [{ label: "Create PM plan", href: `/app/pm/new?asset=${encodeURIComponent(id)}${storeId ? `&store=${encodeURIComponent(storeId)}` : ""}`, kind: "secondary" as const, icon: "pm" as const }]
              : []),
          ]}
        /> : null}
    />
  );
}
