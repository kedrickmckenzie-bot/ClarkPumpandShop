import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { SetupActions } from "@/components/ops/setup-forms";
import { DetailView } from "@/components/ops/views";
import { loadDetailModel, loadOperatorSession } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Store" };

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, session] = await Promise.all([loadDetailModel("store", id), loadOperatorSession()]);
  const canSetupEquipment = roleCan(session.role, "setup_equipment");
  const canSetupPm = roleCan(session.role, "setup_pm");
  return (
    <DetailView
      model={model}
      beforeSections={canSetupEquipment || canSetupPm ? (
        <SetupActions
          title="Continue store setup"
          description="Add equipment and preventive maintenance when it creates useful visibility; neither is required to report or authorize service."
          actions={[
            ...(canSetupEquipment
              ? [{ label: "Set up store equipment", href: `/app/stores/${encodeURIComponent(id)}/equipment-setup`, icon: "asset" as const }]
              : []),
            ...(canSetupPm
              ? [{ label: "Create PM plan", href: `/app/pm/new?store=${encodeURIComponent(id)}`, kind: "secondary" as const, icon: "pm" as const }]
              : []),
          ]}
        />
      ) : undefined}
    />
  );
}
