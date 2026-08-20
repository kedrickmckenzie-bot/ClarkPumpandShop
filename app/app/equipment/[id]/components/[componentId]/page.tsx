import type { Metadata } from "next";
import { DetailView } from "@/components/ops/views";
import { ComponentLifecyclePanel } from "@/components/ops/component-lifecycle-panel";
import { roleCan } from "@/components/ops/role-policy";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "../../../../_data/operator-loader";
import { loadComponentDetailModel } from "../../../../_data/setup-loader";

export const metadata: Metadata = { title: "Component detail" };

export default async function ComponentDetailPage({
  params,
}: {
  params: Promise<{ id: string; componentId: string }>;
}) {
  const { id, componentId } = await params;
  const session = await loadOperatorSession();
  const [model, fixture] = await Promise.all([loadComponentDetailModel(id, componentId), getServerOpsFixtureSnapshot(session.organizationId)]);
  const asset = fixture.assets.find((item) => item.id === id && item.organizationId === session.organizationId);
  const component = fixture.components.find((item) => item.id === componentId && item.assetId === id && item.organizationId === session.organizationId);
  return <DetailView model={model} beforeSections={asset && component ? <ComponentLifecyclePanel fixture={fixture} asset={asset} component={component} canManage={roleCan(session.role, "manage_lifecycle")} /> : null} />;
}
