import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { SetupActions } from "@/components/ops/setup-forms";
import { DetailView } from "@/components/ops/views";
import { AssetReplacementIntelligencePanel } from "@/components/ops/replacement-intelligence-panel";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { loadDetailModel, loadOperatorSession } from "../../_data/operator-loader";
import { loadAssetReplacementIntelligenceModel } from "../../_data/replacement-loader";

export const metadata: Metadata = { title: "Equipment detail" };

type Query = Record<string, string | string[] | undefined>;

export default async function EquipmentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const { id } = await params;
  const query = await searchParams;
  const requestedSection = Array.isArray(query.section) ? query.section[0] : query.section;
  const session = await loadOperatorSession();
  const [model, fixture, replacement] = await Promise.all([
    loadDetailModel("equipment", id),
    getServerOpsFixtureSnapshot(session.organizationId),
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
      initialSection={requestedSection ?? "service-history"}
      beforeSections={(
        <>
        {replacement ? <AssetReplacementIntelligencePanel model={replacement} /> : null}
        {canSetupEquipment || canSetupPm ? <SetupActions
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
        </>
      )}
    />
  );
}
