import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { SetupActions } from "@/components/ops/setup-forms";
import { StoreQrMaterial } from "@/components/ops/store-qr-material";
import { DetailView } from "@/components/ops/views";
import { NORTHLINE_DEMO_ENTRY_TOKENS, NORTHLINE_DEMO_HANDLES } from "@/lib/ops/fixtures";
import { loadDetailModel, loadOperatorSession } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Store" };

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [model, session] = await Promise.all([loadDetailModel("store", id), loadOperatorSession()]);
  const canSetupEquipment = session.demoEdition === "complete" && roleCan(session, "setup_equipment");
  const canSetupPm = session.demoEdition === "complete" && roleCan(session, "setup_pm");
  const hasDemoVendorQr = id === NORTHLINE_DEMO_HANDLES.storyStoreId;
  return (
    <DetailView
      model={model}
      after={hasDemoVendorQr || canSetupEquipment || canSetupPm ? (
        <>
          {hasDemoVendorQr ? (
            <StoreQrMaterial
              configuredOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
              storeName={model.page.eyebrow ?? model.page.title}
              storeNumber={model.page.title.replace(/^Store\s+/i, "")}
              targetPath={`/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}`}
            />
          ) : null}
          {canSetupEquipment || canSetupPm ? (
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
          ) : null}
        </>
      ) : undefined}
    />
  );
}
