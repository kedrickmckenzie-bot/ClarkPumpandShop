import "server-only";

import { notFound } from "next/navigation";
import type {
  StoreEquipmentNamingViewModel,
  StoreEquipmentSetupViewModel,
} from "@/components/ops/store-equipment-setup";
import { roleCan } from "@/components/ops/role-policy";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { domainLabel } from "@/lib/product/domain-label";
import { loadOperatorSession } from "./operator-loader";

export async function loadStoreEquipmentSetupModel(storeId: string): Promise<StoreEquipmentSetupViewModel> {
  const session = await loadOperatorSession();
  if (!roleCan(session, "setup_equipment")) notFound();
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
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

function assetHierarchyLabel(categoryKey: string, groupPath: readonly string[]) {
  const category = domainLabel(categoryKey);
  const first = groupPath[0]?.toLocaleLowerCase("en-US");
  const hierarchy = first === category.toLocaleLowerCase("en-US") || first === categoryKey.toLocaleLowerCase("en-US")
    ? groupPath
    : [category, ...groupPath];
  return hierarchy.join(" › ");
}

export async function loadStoreEquipmentNamingModel(
  storeId: string,
  requestedAssetIds: readonly string[],
): Promise<StoreEquipmentNamingViewModel> {
  const session = await loadOperatorSession();
  if (!roleCan(session, "setup_equipment")) notFound();
  const uniqueAssetIds = [...new Set(requestedAssetIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueAssetIds.length || uniqueAssetIds.length > 100) notFound();

  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  const store = fixture.stores.find((row) => row.organizationId === session.organizationId && row.id === storeId);
  if (!store || session.storeIds && !session.storeIds.includes(store.id) || session.regionIds && !session.regionIds.includes(store.regionId ?? "")) notFound();

  const assets = uniqueAssetIds.map((id) => fixture.assets.find(
    (asset) => asset.organizationId === session.organizationId && asset.storeId === store.id && asset.id === id,
  ));
  if (assets.some((asset) => !asset)) notFound();

  const equipmentTemplates = fixture.equipmentTemplates ?? [];
  const equipment = assets.map((asset) => {
    if (!asset) throw new Error("Equipment scope was validated before presentation");
    const template = equipmentTemplates.find(
      (candidate) => candidate.organizationId === session.organizationId
        && candidate.taxonomyNodeId === asset.taxonomyNodeId
        && asset.name.startsWith(candidate.name),
    ) ?? equipmentTemplates.find(
      (candidate) => candidate.organizationId === session.organizationId
        && candidate.taxonomyNodeId === asset.taxonomyNodeId,
    );
    return {
      id: asset.id,
      assetTag: asset.assetTag,
      currentName: asset.name,
      equipmentType: template?.name ?? asset.groupPath.at(-1) ?? domainLabel(asset.categoryKey),
      categoryLabel: assetHierarchyLabel(asset.categoryKey, asset.groupPath),
      componentCount: fixture.components.filter(
        (component) => component.organizationId === session.organizationId && component.assetId === asset.id,
      ).length,
    };
  });

  return {
    storeId: store.id,
    storeLabel: `Store ${store.storeNumber} · ${store.name}`,
    addressLabel: `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`,
    action: `/api/ops/stores/${encodeURIComponent(store.id)}/equipment-identity`,
    backHref: `/app/stores/${encodeURIComponent(store.id)}`,
    equipment,
  };
}
