import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { SetupActions } from "@/components/ops/setup-forms";
import { DetailView } from "@/components/ops/views";
import { AssetReplacementIntelligencePanel } from "@/components/ops/replacement-intelligence-panel";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { loadDetailModel, loadOperatorSession } from "../../_data/operator-loader";
import { loadAssetReplacementIntelligenceModel } from "../../_data/replacement-loader";

export const metadata: Metadata = { title: "Equipment detail" };

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadOperatorSession();
  const [model, fixture, replacement] = await Promise.all([
    loadDetailModel("equipment", id),
    getRequestOpsFixtureSnapshot(session.organizationId),
    loadAssetReplacementIntelligenceModel(id),
  ]);
  const asset = fixture.assets.find((item) => item.organizationId === session.organizationId && item.id === id);
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
  const canSetupEquipment = roleCan(session, "setup_equipment");
  const canSetupPm = roleCan(session, "setup_pm");
  const storeId = model.facts.find((fact) => fact.label === "Store")?.link?.href.split("/").at(-1);
  return (
    <DetailView
      model={model}
      initialSection="overview"
      beforeSections={replacement ? <AssetReplacementIntelligencePanel model={replacement} /> : null}
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
