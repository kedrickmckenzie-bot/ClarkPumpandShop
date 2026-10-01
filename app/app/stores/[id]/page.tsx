import { StoreOpenReports } from "@/components/workspace/store-open-reports";
import { StoreActiveWork } from "@/components/workspace/store-active-work";
import { STORE_SECTION_TABS, StoreWorkspaceNav } from "@/components/workspace/store-workspace-nav";
import type { Metadata } from "next";
import { roleCan } from "@/components/ops/role-policy";
import { SetupActions } from "@/components/ops/setup-forms";
import { StoreQrMaterial } from "@/components/ops/store-qr-material";
import { DetailView } from "@/components/ops/views";
import { NORTHLINE_DEMO_ENTRY_TOKENS, NORTHLINE_DEMO_HANDLES } from "@/lib/ops/fixtures";
import { loadDetailModel, loadOperatorSession } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Store" };

export default async function StoreDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string | string[] }> }) {
  const { id } = await params;
  const requested = (await searchParams).section;
  const section = STORE_SECTION_TABS.find((tab) => tab.id === (Array.isArray(requested) ? requested[0] : requested))?.id;
  const [model, session] = await Promise.all([loadDetailModel("store", id), loadOperatorSession()]);
  const canSetupEquipment = session.demoEdition === "complete" && roleCan(session, "setup_equipment");
  const canSetupPm = session.demoEdition === "complete" && roleCan(session, "setup_pm");
  const hasDemoVendorQr = id === NORTHLINE_DEMO_HANDLES.storyStoreId;
  const canCreateQr = model.state.kind === "ready" && roleCan(session, "issue_work_order");
  const ready = model.state.kind === "ready";
  // The page's main action is the work people start here: create work, or report a problem.
  if (!ready) model.page.primaryAction = undefined;
  else if (roleCan(session, "create_work_order")) model.page.primaryAction = { label: "Create work order", href: `/app/work-orders/new?store=${encodeURIComponent(id)}` };
  else if (roleCan(session, "create_request")) model.page.primaryAction = { label: "Report an issue", href: `/app/requests/new?store=${encodeURIComponent(id)}` };
  model.page.secondaryAction = undefined;
  return (
    <DetailView
      model={model}
      embeddedSections
      hideFacts
      beforeFacts={<><StoreWorkspaceNav id={id} active={section ?? "overview"} />{ready && !section ? <><StoreOpenReports id={id} /><StoreActiveWork id={id} /></> : null}</>}
      after={!section && (canCreateQr || canSetupEquipment || canSetupPm) ? (
        <>
          {canCreateQr ? (
            <StoreQrMaterial
              configuredOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
              storeName={model.page.eyebrow ?? model.page.title}
              storeNumber={model.page.title.replace(/^Store\s+/i, "")}
              storeId={id}
              targetPath={hasDemoVendorQr ? `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}` : undefined}
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
                  ? [{ label: "Manage store PM", href: `/app/pm?store=${encodeURIComponent(id)}&setup=plans`, kind: "secondary" as const, icon: "pm" as const }, { label: "Create PM plan", href: `/app/pm/new?store=${encodeURIComponent(id)}`, kind: "secondary" as const, icon: "pm" as const }]
                  : []),
              ]}
            />
          ) : null}
        </>
      ) : undefined}
    />
  );
}
