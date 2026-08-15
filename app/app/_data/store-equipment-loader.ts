import "server-only";

import { notFound } from "next/navigation";
import type { StoreEquipmentSetupViewModel } from "@/components/ops/store-equipment-setup";
import { roleCan } from "@/components/ops/role-policy";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "./operator-loader";

export async function loadStoreEquipmentSetupModel(storeId: string): Promise<StoreEquipmentSetupViewModel> {
  const session = await loadOperatorSession();
  if (!roleCan(session.role, "setup_equipment")) notFound();
  const fixture = await getServerOpsFixtureSnapshot(session.organizationId);
  const equipmentTemplates = fixture.equipmentTemplates ?? [];
  const componentTemplates = fixture.componentTemplates ?? [];
  const store = fixture.stores.find((row) => row.organizationId === session.organizationId && row.id === storeId);
  if (!store || session.storeIds && !session.storeIds.includes(store.id) || session.regionIds && !session.regionIds.includes(store.regionId ?? "")) notFound();
  const nodes = fixture.taxonomyNodes.filter((row) => row.organizationId === session.organizationId && row.active);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path = (id: string) => { const names: string[] = []; let node = byId.get(id); while (node) { names.unshift(node.name); node = node.parentNodeId ? byId.get(node.parentNodeId) : undefined; } return names; };
  const groups = nodes.filter((node) => node.nodeKind === "group" && equipmentTemplates.some((template) => template.organizationId === session.organizationId && template.taxonomyNodeId === node.id && template.active)).map((group) => ({ id: group.id, name: group.name, pathLabel: path(group.id).slice(0, -1).join(" › "), templates: equipmentTemplates.filter((template) => template.organizationId === session.organizationId && template.taxonomyNodeId === group.id && template.active).map((template) => ({ id: template.id, name: template.name, expectedLifeLabel: template.defaultExpectedLifeYears ? `${template.defaultExpectedLifeYears}-year expected life` : "Expected life can be added later", componentLabel: `${componentTemplates.filter((component) => component.organizationId === session.organizationId && component.equipmentTemplateId === template.id).length} standard components`, alreadyAtStore: fixture.assets.filter((asset) => asset.organizationId === session.organizationId && asset.storeId === store.id && asset.taxonomyNodeId === group.id && asset.name.startsWith(template.name)).length })) }));
  return { storeId: store.id, storeLabel: `Store ${store.storeNumber} · ${store.name}`, addressLabel: `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`, action: `/api/ops/stores/${encodeURIComponent(store.id)}/equipment-templates`, backHref: `/app/stores/${encodeURIComponent(store.id)}`, groups };
}
