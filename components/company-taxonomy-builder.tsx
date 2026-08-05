"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Box,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  FolderTree,
  Info,
  Layers3,
  PencilLine,
  RotateCcw,
  Store,
  Tag,
  X,
} from "lucide-react";

type TaxonomyNode = {
  id: string;
  canonicalKey: string;
  name: string;
  aliases: string[];
  children: TaxonomyNode[];
};

const seedTaxonomy: TaxonomyNode = {
  id: "company-root",
  canonicalKey: "physical_maintenance",
  name: "Company maintenance taxonomy",
  aliases: ["Equipment tree", "Maintenance hierarchy"],
  children: [
    {
      id: "refrigeration",
      canonicalKey: "refrigeration",
      name: "Refrigeration",
      aliases: ["Cold side", "Refrig"],
      children: [
        {
          id: "coolers",
          canonicalKey: "refrigeration.coolers",
          name: "Coolers",
          aliases: ["Cooler boxes"],
          children: [
            {
              id: "walk-in-coolers",
              canonicalKey: "refrigeration.coolers.walk_in",
              name: "Walk-In Coolers",
              aliases: ["WIC", "Cold rooms"],
              children: [
                {
                  id: "beer-cave",
                  canonicalKey: "refrigeration.coolers.walk_in.beer_cave",
                  name: "Beer Cave",
                  aliases: ["Beer box", "Beverage cave"],
                  children: [
                    {
                      id: "beer-cave-condensing",
                      canonicalKey: "refrigeration.coolers.walk_in.beer_cave.condensing",
                      name: "Condensing Systems",
                      aliases: ["Condensing units", "CU"],
                      children: [],
                    },
                    {
                      id: "beer-cave-evaporators",
                      canonicalKey: "refrigeration.coolers.walk_in.beer_cave.evaporators",
                      name: "Evaporator Systems",
                      aliases: ["Evap units", "Unit coolers"],
                      children: [],
                    },
                  ],
                },
                {
                  id: "backroom-walk-in",
                  canonicalKey: "refrigeration.coolers.walk_in.backroom",
                  name: "Backroom Walk-In",
                  aliases: ["Stock cooler"],
                  children: [],
                },
              ],
            },
            {
              id: "reach-in-coolers",
              canonicalKey: "refrigeration.coolers.reach_in",
              name: "Reach-In Coolers",
              aliases: ["RIC", "Merchandisers"],
              children: [
                {
                  id: "glass-door-coolers",
                  canonicalKey: "refrigeration.coolers.reach_in.glass_door",
                  name: "Glass-Door Merchandisers",
                  aliases: ["Beverage doors", "Glass fronts"],
                  children: [],
                },
                {
                  id: "under-counter-coolers",
                  canonicalKey: "refrigeration.coolers.reach_in.under_counter",
                  name: "Under-Counter Coolers",
                  aliases: ["Low boys"],
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "freezers",
          canonicalKey: "refrigeration.freezers",
          name: "Freezers",
          aliases: ["Frozen equipment"],
          children: [
            {
              id: "walk-in-freezers",
              canonicalKey: "refrigeration.freezers.walk_in",
              name: "Walk-In Freezers",
              aliases: ["WIF", "Frozen storage"],
              children: [],
            },
            {
              id: "reach-in-freezers",
              canonicalKey: "refrigeration.freezers.reach_in",
              name: "Reach-In Freezers",
              aliases: ["Frozen merchandisers"],
              children: [
                {
                  id: "island-freezers",
                  canonicalKey: "refrigeration.freezers.reach_in.island",
                  name: "Island Freezers",
                  aliases: ["Coffin cases"],
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "ice-machines",
          canonicalKey: "refrigeration.ice_machines",
          name: "Ice Machines",
          aliases: ["Ice makers"],
          children: [],
        },
      ],
    },
    {
      id: "hvac",
      canonicalKey: "hvac",
      name: "HVAC",
      aliases: ["Heating & Cooling", "Climate"],
      children: [
        {
          id: "rooftop-units",
          canonicalKey: "hvac.rooftop_units",
          name: "Rooftop Units",
          aliases: ["RTUs", "Roof units"],
          children: [
            {
              id: "packaged-rtus",
              canonicalKey: "hvac.rooftop_units.packaged",
              name: "Packaged RTUs",
              aliases: ["Packaged units"],
              children: [
                {
                  id: "gas-electric-rtus",
                  canonicalKey: "hvac.rooftop_units.packaged.gas_electric",
                  name: "Gas / Electric RTUs",
                  aliases: ["Gas packs"],
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "mini-splits",
          canonicalKey: "hvac.mini_splits",
          name: "Mini-Splits",
          aliases: ["Ductless units"],
          children: [],
        },
        {
          id: "ventilation",
          canonicalKey: "hvac.ventilation",
          name: "Ventilation",
          aliases: ["Exhaust and make-up air"],
          children: [],
        },
      ],
    },
    {
      id: "fuel-forecourt",
      canonicalKey: "fuel_forecourt",
      name: "Fuel & Forecourt",
      aliases: ["Pumps", "Fuel island"],
      children: [
        {
          id: "fuel-dispensers",
          canonicalKey: "fuel_forecourt.dispensers",
          name: "Fuel Dispensers",
          aliases: ["Pumps", "MPDs"],
          children: [
            {
              id: "dispenser-hydraulics",
              canonicalKey: "fuel_forecourt.dispensers.hydraulics",
              name: "Dispenser Hydraulics",
              aliases: ["Metering and valves"],
              children: [],
            },
            {
              id: "dispenser-electronics",
              canonicalKey: "fuel_forecourt.dispensers.electronics",
              name: "Dispenser Electronics",
              aliases: ["Displays and card readers"],
              children: [],
            },
          ],
        },
        {
          id: "fuel-canopy",
          canonicalKey: "fuel_forecourt.canopy",
          name: "Canopy",
          aliases: ["Fuel canopy"],
          children: [],
        },
      ],
    },
    {
      id: "landscaping",
      canonicalKey: "landscaping",
      name: "Landscaping",
      aliases: ["Grounds", "Exterior care"],
      children: [
        {
          id: "landscape-grounds",
          canonicalKey: "landscaping.grounds",
          name: "Grounds",
          aliases: ["Turf and beds"],
          children: [],
        },
      ],
    },
    {
      id: "parking-lot",
      canonicalKey: "parking_lot",
      name: "Parking Lot",
      aliases: ["Site paving", "Lot"],
      children: [
        {
          id: "pavement",
          canonicalKey: "parking_lot.pavement",
          name: "Pavement",
          aliases: ["Asphalt and concrete"],
          children: [
            {
              id: "striping",
              canonicalKey: "parking_lot.pavement.striping",
              name: "Striping & Markings",
              aliases: ["Lot paint"],
              children: [],
            },
          ],
        },
        {
          id: "lot-lighting",
          canonicalKey: "parking_lot.lighting",
          name: "Lot Lighting",
          aliases: ["Pole lights"],
          children: [],
        },
      ],
    },
    {
      id: "plumbing",
      canonicalKey: "plumbing",
      name: "Plumbing",
      aliases: ["Water and drains"],
      children: [],
    },
    {
      id: "snow-ice",
      canonicalKey: "snow_ice",
      name: "Snow & Ice",
      aliases: ["Winter service"],
      children: [
        {
          id: "snow-lot",
          canonicalKey: "snow_ice.parking_lot",
          name: "Parking Lot Service",
          aliases: ["Plowing and salting"],
          children: [],
        },
        {
          id: "snow-walkways",
          canonicalKey: "snow_ice.walkways",
          name: "Walkways",
          aliases: ["Sidewalk treatment"],
          children: [],
        },
      ],
    },
  ],
};

function cloneSeed() {
  return structuredClone(seedTaxonomy) as TaxonomyNode;
}

function findNode(node: TaxonomyNode, id: string): TaxonomyNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const match = findNode(child, id);
    if (match) return match;
  }
  return undefined;
}

function findPath(node: TaxonomyNode, id: string, ancestors: TaxonomyNode[] = []): TaxonomyNode[] {
  const nextPath = [...ancestors, node];
  if (node.id === id) return nextPath;
  for (const child of node.children) {
    const match = findPath(child, id, nextPath);
    if (match.length) return match;
  }
  return [];
}

function updateNode(
  node: TaxonomyNode,
  id: string,
  updater: (current: TaxonomyNode) => TaxonomyNode,
): TaxonomyNode {
  if (node.id === id) return updater(node);
  return { ...node, children: node.children.map((child) => updateNode(child, id, updater)) };
}

function moveNode(node: TaxonomyNode, id: string, offset: -1 | 1): TaxonomyNode {
  const index = node.children.findIndex((child) => child.id === id);
  if (index >= 0) {
    const destination = index + offset;
    if (destination < 0 || destination >= node.children.length) return node;
    const children = [...node.children];
    [children[index], children[destination]] = [children[destination], children[index]];
    return { ...node, children };
  }
  return { ...node, children: node.children.map((child) => moveNode(child, id, offset)) };
}

function siblingPosition(node: TaxonomyNode, id: string): { index: number; count: number } | undefined {
  const index = node.children.findIndex((child) => child.id === id);
  if (index >= 0) return { index, count: node.children.length };
  for (const child of node.children) {
    const match = siblingPosition(child, id);
    if (match) return match;
  }
  return undefined;
}

function collectExpandableIds(node: TaxonomyNode): string[] {
  const ids = node.children.length ? [node.id] : [];
  return [...ids, ...node.children.flatMap(collectExpandableIds)];
}

function treeSummary(node: TaxonomyNode, depth = 0): { nodes: number; aliases: number; maxDepth: number } {
  const childSummaries = node.children.map((child) => treeSummary(child, depth + 1));
  return {
    nodes: (depth === 0 ? 0 : 1) + childSummaries.reduce((total, summary) => total + summary.nodes, 0),
    aliases: node.aliases.length + childSummaries.reduce((total, summary) => total + summary.aliases, 0),
    maxDepth: Math.max(depth, ...childSummaries.map((summary) => summary.maxDepth)),
  };
}

function depthLabel(depth: number) {
  if (depth === 0) return "Company root";
  if (depth === 1) return "Department";
  return `Shared group · level ${depth}`;
}

export function CompanyTaxonomyBuilder() {
  const [tree, setTree] = useState<TaxonomyNode>(cloneSeed);
  const [selectedId, setSelectedId] = useState("refrigeration");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(["company-root", "refrigeration", "coolers", "walk-in-coolers"]),
  );
  const [nextCustomId, setNextCustomId] = useState(1);
  const [announcement, setAnnouncement] = useState("Refrigeration selected.");

  const selectedNode = useMemo(() => findNode(tree, selectedId) ?? tree, [selectedId, tree]);
  const selectedPath = useMemo(() => findPath(tree, selectedNode.id), [selectedNode.id, tree]);
  const selectedDepth = Math.max(0, selectedPath.length - 1);
  const position = siblingPosition(tree, selectedNode.id);
  const summary = useMemo(() => treeSummary(tree), [tree]);

  function selectNode(node: TaxonomyNode) {
    setSelectedId(node.id);
    setAnnouncement(`${node.name} selected.`);
  }

  function toggleNode(nodeId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function renameSelected(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setTree((current) => updateNode(current, selectedNode.id, (node) => ({ ...node, name: trimmedName })));
    setAnnouncement(`${selectedNode.name} renamed to ${trimmedName}.`);
  }

  function addAlias(alias: string) {
    const trimmedAlias = alias.trim();
    if (!trimmedAlias || selectedNode.aliases.some((item) => item.toLowerCase() === trimmedAlias.toLowerCase())) return;
    setTree((current) => updateNode(current, selectedNode.id, (node) => ({ ...node, aliases: [...node.aliases, trimmedAlias] })));
    setAnnouncement(`${trimmedAlias} added as a local term for ${selectedNode.name}.`);
  }

  function removeAlias(alias: string) {
    setTree((current) => updateNode(current, selectedNode.id, (node) => ({ ...node, aliases: node.aliases.filter((item) => item !== alias) })));
    setAnnouncement(`${alias} removed from ${selectedNode.name}.`);
  }

  function addChild(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const childId = `custom-${nextCustomId}`;
    const child: TaxonomyNode = {
      id: childId,
      canonicalKey: `custom.${nextCustomId}`,
      name: trimmedName,
      aliases: [],
      children: [],
    };
    setTree((current) => updateNode(current, selectedNode.id, (node) => ({ ...node, children: [...node.children, child] })));
    setExpandedIds((current) => new Set([...current, selectedNode.id]));
    setSelectedId(childId);
    setNextCustomId((current) => current + 1);
    setAnnouncement(`${trimmedName} added below ${selectedNode.name}.`);
  }

  function reorderSelected(offset: -1 | 1) {
    setTree((current) => moveNode(current, selectedNode.id, offset));
    setAnnouncement(`${selectedNode.name} moved ${offset === -1 ? "up" : "down"} within its siblings.`);
  }

  function resetDemo() {
    setTree(cloneSeed());
    setSelectedId("refrigeration");
    setExpandedIds(new Set(["company-root", "refrigeration", "coolers", "walk-in-coolers"]));
    setNextCustomId(1);
    setAnnouncement("Demo taxonomy reset.");
  }

  return (
    <section className="ct-shell" aria-labelledby="ct-title">
      <header className="ct-hero">
        <div className="ct-hero-copy">
          <span className="ct-eyebrow">Company setup · shared physical language</span>
          <h1 id="ct-title">Define equipment once. Let every store speak the same language.</h1>
          <p>
            Build as many parent and child groups as the company needs. Refrigeration can be deep, landscaping
            can stay simple, and each store activates only the branches that apply to that location.
          </p>
        </div>
        <div className="ct-principle-card">
          <Info />
          <div>
            <strong>Physical hierarchy, not accounting structure</strong>
            <p>GL accounts and accounting cost centers remain separate. Renaming a group never changes its stable reporting identity.</p>
          </div>
        </div>
      </header>

      <section className="ct-model-strip" aria-label="How shared taxonomy becomes store equipment">
        <article><span><Building2 /></span><div><small>1 · Company language</small><strong>Refrigeration → Coolers → Reach-In Coolers</strong><p>One governed tree and shared aliases.</p></div></article>
        <ArrowRight className="ct-model-arrow" />
        <article><span><Store /></span><div><small>2 · Store setup</small><strong>Store 45 activates this branch</strong><p>Other branches can remain inactive there.</p></div></article>
        <ArrowRight className="ct-model-arrow" />
        <article><span><Box /></span><div><small>3 · Store instance</small><strong>Cooler 3</strong><p>The real asset receives model, serial and warranty details.</p></div></article>
      </section>

      <div className="ct-summary-bar">
        <div><strong>{summary.nodes}</strong><span>Shared groups</span></div>
        <div><strong>{summary.maxDepth}</strong><span>Deepest level</span></div>
        <div><strong>{summary.aliases}</strong><span>Aliases and local terms</span></div>
        <p><CheckCircle2 /> Demo Mode · changes last only for this page session</p>
      </div>

      <div className="ct-workspace">
        <section className="ct-tree-panel" aria-labelledby="ct-tree-title">
          <header className="ct-panel-heading">
            <div><span>Shared taxonomy</span><h2 id="ct-tree-title">Company equipment tree</h2></div>
            <div className="ct-tree-actions">
              <button type="button" onClick={() => setExpandedIds(new Set(collectExpandableIds(tree)))}>Expand all</button>
              <button type="button" onClick={() => setExpandedIds(new Set(["company-root"]))}>Collapse</button>
            </div>
          </header>
          <div className="ct-tree-scroll">
            <ul className="ct-tree" role="tree" aria-label="Company equipment taxonomy">
              <TaxonomyTreeItem
                node={tree}
                depth={0}
                selectedId={selectedNode.id}
                expandedIds={expandedIds}
                onSelect={selectNode}
                onToggle={toggleNode}
              />
            </ul>
          </div>
          <footer className="ct-tree-footer">
            <button type="button" onClick={resetDemo}><RotateCcw />Reset demo tree</button>
            <span>Use the company root to add another top-level department.</span>
          </footer>
        </section>

        <section className="ct-editor-panel" aria-labelledby="ct-editor-title">
          <nav className="ct-breadcrumbs" aria-label="Selected taxonomy path">
            {selectedPath.map((node, index) => (
              <span key={node.id}>
                {index > 0 && <ChevronRight />}
                <button type="button" onClick={() => selectNode(node)}>{node.name}</button>
              </span>
            ))}
          </nav>
          <header className="ct-editor-heading">
            <div>
              <span>{depthLabel(selectedDepth)}</span>
              <h2 id="ct-editor-title">{selectedNode.name}</h2>
              <p>{selectedNode.children.length} direct child group{selectedNode.children.length === 1 ? "" : "s"} · stable key <code>{selectedNode.canonicalKey}</code></p>
            </div>
            {selectedNode.id !== tree.id && (
              <div className="ct-order-controls" aria-label={`Reorder ${selectedNode.name}`}>
                <button type="button" disabled={!position || position.index === 0} onClick={() => reorderSelected(-1)} aria-label={`Move ${selectedNode.name} up`}><ArrowUp /></button>
                <button type="button" disabled={!position || position.index === position.count - 1} onClick={() => reorderSelected(1)} aria-label={`Move ${selectedNode.name} down`}><ArrowDown /></button>
              </div>
            )}
          </header>

          <NodeEditor
            key={selectedNode.id}
            node={selectedNode}
            depth={selectedDepth}
            onRename={renameSelected}
            onAddAlias={addAlias}
            onRemoveAlias={removeAlias}
            onAddChild={addChild}
          />

          <section className="ct-store-activation">
            <div className="ct-section-heading">
              <div><span>How stores use this</span><h3>Activate the branch, then create real equipment</h3></div>
              <Store />
            </div>
            <div className="ct-activation-flow">
              <div><small>Shared concept selected</small><strong>{selectedPath.slice(1).map((node) => node.name).join(" → ") || selectedNode.name}</strong></div>
              <ArrowRight />
              <div><small>At a store</small><strong>Turn this branch on only when relevant</strong></div>
              <ArrowRight />
              <div><small>Below the tree</small><strong>Create named asset instances</strong></div>
            </div>
            <p className="ct-instance-note">
              <Box /> <strong>Cooler 3 is not a company taxonomy node.</strong> It is a Store 45 asset linked to the
              shared “Reach-In Coolers” concept, where its manufacturer, model, serial number, supplier, warranty,
              service history and costs belong.
            </p>
          </section>
        </section>
      </div>
      <p className="ct-announcement" role="status" aria-live="polite">{announcement}</p>
    </section>
  );
}

function TaxonomyTreeItem({
  node,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}: {
  node: TaxonomyNode;
  depth: number;
  selectedId: string;
  expandedIds: Set<string>;
  onSelect: (node: TaxonomyNode) => void;
  onToggle: (nodeId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const selected = selectedId === node.id;

  return (
    <li
      className="ct-tree-item"
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
    >
      <div className={selected ? "ct-tree-row ct-tree-row-selected" : "ct-tree-row"} style={{ "--ct-depth": depth } as React.CSSProperties}>
        {hasChildren ? (
          <button className="ct-expand-button" type="button" onClick={() => onToggle(node.id)} aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}>
            {expanded ? <ChevronDown /> : <ChevronRight />}
          </button>
        ) : <span className="ct-expand-placeholder" />}
        <button className="ct-node-button" type="button" onClick={() => onSelect(node)} aria-current={selected ? "true" : undefined}>
          <span className="ct-node-icon">{depth === 0 ? <FolderTree /> : hasChildren ? <Layers3 /> : <Box />}</span>
          <span className="ct-node-copy"><strong>{node.name}</strong><small>{depthLabel(depth)}{node.aliases.length ? ` · ${node.aliases[0]}` : ""}</small></span>
          {hasChildren && <b>{node.children.length}</b>}
        </button>
      </div>
      {hasChildren && expanded && (
        <ul className="ct-tree-group" role="group">
          {node.children.map((child) => (
            <TaxonomyTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function NodeEditor({
  node,
  depth,
  onRename,
  onAddAlias,
  onRemoveAlias,
  onAddChild,
}: {
  node: TaxonomyNode;
  depth: number;
  onRename: (name: string) => void;
  onAddAlias: (alias: string) => void;
  onRemoveAlias: (alias: string) => void;
  onAddChild: (name: string) => void;
}) {
  const [name, setName] = useState(node.name);
  const [alias, setAlias] = useState("");
  const [childName, setChildName] = useState("");

  return (
    <div className="ct-editor-sections">
      <section className="ct-edit-card">
        <div className="ct-card-heading"><span><PencilLine /></span><div><h3>Preferred company name</h3><p>Change what people see without changing the stable reporting key.</p></div></div>
        <form onSubmit={(event) => { event.preventDefault(); onRename(name); }}>
          <label><span>Group name</span><input value={name} onChange={(event) => setName(event.target.value)} aria-label="Selected group name" /></label>
          <button type="submit" disabled={!name.trim() || name.trim() === node.name}>Save name</button>
        </form>
      </section>

      <section className="ct-edit-card">
        <div className="ct-card-heading"><span><Tag /></span><div><h3>Aliases and local terms</h3><p>Search and imports can recognize familiar words without splitting reports.</p></div></div>
        <div className="ct-alias-list" aria-label={`Aliases for ${node.name}`}>
          {node.aliases.map((item) => (
            <span key={item}>{item}<button type="button" onClick={() => onRemoveAlias(item)} aria-label={`Remove ${item} alias`}><X /></button></span>
          ))}
          {!node.aliases.length && <em>No aliases yet</em>}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (alias.trim()) { onAddAlias(alias); setAlias(""); } }}>
          <label><span>Add local term</span><input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Example: Cold box" /></label>
          <button type="submit" disabled={!alias.trim()}><CirclePlus />Add alias</button>
        </form>
      </section>

      <section className="ct-edit-card ct-add-child-card">
        <div className="ct-card-heading"><span><CirclePlus /></span><div><h3>Add a child below {node.name}</h3><p>{depth === 0 ? "This creates another top-level department." : `This becomes level ${depth + 1}. There is no fixed depth limit.`}</p></div></div>
        <form onSubmit={(event) => { event.preventDefault(); if (childName.trim()) { onAddChild(childName); setChildName(""); } }}>
          <label><span>New child group</span><input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder={depth === 0 ? "Example: Electrical" : "Example: Door assemblies"} /></label>
          <button type="submit" disabled={!childName.trim()}><CirclePlus />Add below this group</button>
        </form>
      </section>
    </div>
  );
}
