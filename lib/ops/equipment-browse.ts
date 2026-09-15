import type { Asset, OpsFixture } from "./types";

export function equipmentType(asset: Asset, fixture: OpsFixture) {
  const template = fixture.equipmentTemplates.find((item) => item.organizationId === asset.organizationId && item.id === asset.equipmentTemplateId);
  const taxonomy = fixture.taxonomyNodes.find((item) => item.organizationId === asset.organizationId && item.id === asset.taxonomyNodeId);
  const label = template?.name ?? taxonomy?.name ?? asset.groupPath.at(-1) ?? "Unclassified equipment";
  return {
    id: template ? `template:${template.id}` : taxonomy ? `taxonomy:${taxonomy.id}` : `group:${asset.groupPath.join("|") || "unclassified"}`,
    label: /dispenser/i.test(label) ? `${label} (gas pumps)` : label,
  };
}
