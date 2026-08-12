import type { Metadata } from "next";
import { SetupActions } from "@/components/ops/setup-forms";
import { DetailView } from "@/components/ops/views";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { loadDetailModel, loadOperatorSession } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Equipment detail" };

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadOperatorSession();
  const [model, fixture] = await Promise.all([
    loadDetailModel("equipment", id),
    getServerOpsFixtureSnapshot(session.organizationId),
  ]);
  const asset = fixture.assets.find((item) => item.organizationId === session.organizationId && item.id === id);
  if (asset) model.facts.splice(4, 0, { label: "Supplier", value: asset.supplier ?? "Not entered" });
  const componentSection = model.sections.find((section) => section.id === "components");
  if (componentSection?.table) {
    componentSection.table.rows = componentSection.table.rows.map((row) => ({
      ...row,
      href: `/app/equipment/${encodeURIComponent(id)}/components/${encodeURIComponent(row.id)}`,
    }));
    if (["facilities", "regional", "store_manager"].includes(session.role)) {
      componentSection.action = { label: "Add component", href: `/app/equipment/${encodeURIComponent(id)}/components/new` };
    }
  }
  const canSetup = ["facilities", "regional", "store_manager"].includes(session.role);
  const storeId = model.facts.find((fact) => fact.label === "Store")?.link?.href.split("/").at(-1);
  return (
    <DetailView
      model={model}
      after={canSetup ? (
        <SetupActions
          title="Build out this equipment record"
          description="Add component depth or schedule preventive work. Both features stay optional and connect back to this equipment history."
          actions={[
            { label: "Add component", href: `/app/equipment/${encodeURIComponent(id)}/components/new`, icon: "component" },
            { label: "Create PM plan", href: `/app/pm/new?asset=${encodeURIComponent(id)}${storeId ? `&store=${encodeURIComponent(storeId)}` : ""}`, kind: "secondary", icon: "pm" },
          ]}
        />
      ) : undefined}
    />
  );
}
