import "server-only";

import type { TaxonomyManagerViewModel } from "@/components/ops/taxonomy-manager";
import { roleCan } from "@/components/ops/role-policy";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "./operator-loader";

export async function loadTaxonomyManagerModel(): Promise<TaxonomyManagerViewModel> {
  const session = await loadOperatorSession();
  const fixture = await getServerOpsFixtureSnapshot(session.organizationId);
  const equipmentTemplates = fixture.equipmentTemplates ?? [];
  const componentTemplates = fixture.componentTemplates ?? [];
  const nodes = fixture.taxonomyNodes.filter((row) => row.organizationId === session.organizationId).sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const byId = new Map(nodes.map((row) => [row.id, row]));
  const path = (id: string) => { const labels: string[] = []; let node = byId.get(id); while (node) { labels.unshift(node.name); node = node.parentNodeId ? byId.get(node.parentNodeId) : undefined; } return labels.join(" › "); };
  return {
    permitted: roleCan(session.role, "administer"), action: "/api/ops/taxonomy",
    nodes: nodes.map((node) => ({ id: node.id, name: node.name, kind: node.nodeKind, parentNodeId: node.parentNodeId, pathLabel: path(node.id), active: node.active, equipmentCount: fixture.assets.filter((asset) => asset.organizationId === session.organizationId && (asset.taxonomyNodeId === node.id || node.nodeKind === "category" && asset.categoryKey === node.canonicalKey)).length, templates: equipmentTemplates.filter((template) => template.organizationId === session.organizationId && template.taxonomyNodeId === node.id).map((template) => ({ id: template.id, name: template.name, expectedLifeYears: template.defaultExpectedLifeYears, active: template.active, components: componentTemplates.filter((component) => component.organizationId === session.organizationId && component.equipmentTemplateId === template.id).map((component) => component.name) })) })),
    parentOptions: nodes.filter((node) => node.active).map((node) => ({ id: node.id, label: path(node.id), depth: node.depth })),
  };
}
