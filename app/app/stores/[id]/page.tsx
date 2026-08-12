import type { Metadata } from "next";
import { SetupActions } from "@/components/ops/setup-forms";
import { DetailView } from "@/components/ops/views";
import { loadDetailModel, loadOperatorSession } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Store" };

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, session] = await Promise.all([loadDetailModel("store", id), loadOperatorSession()]);
  const canSetup = ["facilities", "regional", "store_manager"].includes(session.role);
  return (
    <DetailView
      model={model}
      after={canSetup ? (
        <SetupActions
          title="Continue store setup"
          description="Add equipment and preventive maintenance when it creates useful visibility; neither is required to report or authorize service."
          actions={[
            { label: "Add equipment", href: `/app/equipment/new?store=${encodeURIComponent(id)}`, icon: "asset" },
            { label: "Create PM plan", href: `/app/pm/new?store=${encodeURIComponent(id)}`, kind: "secondary", icon: "pm" },
          ]}
        />
      ) : undefined}
    />
  );
}
