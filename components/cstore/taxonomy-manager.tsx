"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Layers3, Plus, RotateCcw, Tag, XCircle } from "lucide-react";

import type { MaintenanceCategory, TaxonomyNode } from "@/lib/cstore/types";

export interface TaxonomyCategoryCreateValue {
  label: string;
  description: string;
}

export interface TaxonomyCategoryUpdateValue {
  id: string;
  label: string;
  active: boolean;
}

export interface TaxonomyNodeCreateValue {
  categoryId: string;
  parentId?: string;
  label: string;
  kind: TaxonomyNode["kind"];
}

export interface TaxonomyNodeUpdateValue {
  id: string;
  label: string;
  active: boolean;
}

interface TaxonomyManagerProps {
  categories: MaintenanceCategory[];
  nodes: TaxonomyNode[];
  onCreateCategory: (value: TaxonomyCategoryCreateValue) => void;
  onUpdateCategory: (value: TaxonomyCategoryUpdateValue) => void;
  onCreateNode: (value: TaxonomyNodeCreateValue) => void;
  onUpdateNode: (value: TaxonomyNodeUpdateValue) => void;
}

function nodePath(node: TaxonomyNode, byId: Map<string, TaxonomyNode>) {
  const labels = [node.label];
  let parentId = node.parentId;
  const visited = new Set([node.id]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    labels.unshift(parent.label);
    parentId = parent.parentId;
  }
  return labels.join(" › ");
}

export function TaxonomyManager({ categories, nodes, onCreateCategory, onUpdateCategory, onCreateNode, onUpdateNode }: TaxonomyManagerProps) {
  const [categoryId, setCategoryId] = useState(categories.find((category) => category.active !== false)?.id ?? categories[0]?.id ?? "");
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [categoryLabel, setCategoryLabel] = useState(selectedCategory?.label ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [nodeLabel, setNodeLabel] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeKind, setNewNodeKind] = useState<TaxonomyNode["kind"]>("equipment_type");
  const [newNodeParentId, setNewNodeParentId] = useState("");
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const categoryNodes = nodes
    .filter((node) => node.categoryId === categoryId)
    .sort((left, right) => left.sortOrder - right.sortOrder || nodePath(left, byId).localeCompare(nodePath(right, byId)));
  const selectedNode = categoryNodes.find((node) => node.id === selectedNodeId);

  function chooseCategory(nextId: string) {
    const category = categories.find((record) => record.id === nextId);
    setCategoryId(nextId);
    setCategoryLabel(category?.label ?? "");
    setSelectedNodeId("");
    setNodeLabel("");
    setNewNodeParentId("");
  }

  function chooseNode(nextId: string) {
    const node = nodes.find((record) => record.id === nextId);
    setSelectedNodeId(nextId);
    setNodeLabel(node?.label ?? "");
  }

  return <div>
    <div className="to-callout"><Layers3 /><span><strong>Company naming structure</strong><small>Define the shared language once. Stores can use as much or as little depth as they need: service area › system › equipment type › individual asset › component.</small></span></div>

    <article className="to-panel">
      <header className="to-panel-head"><div><h2>Service areas</h2><p>Company-level categories used across every store.</p></div><span className="to-filter-count">{categories.filter((category) => category.active !== false).length} active</span></header>
      <div className="to-panel-body">
        <div className="to-field"><label htmlFor="taxonomy-category">Select service area</label><select id="taxonomy-category" value={categoryId} onChange={(event) => chooseCategory(event.target.value)}>{categories.map((category) => <option value={category.id} key={category.id}>{category.active === false ? "Retired · " : ""}{category.label}</option>)}</select></div>
        {selectedCategory ? <div className="to-grid equal">
          <div className="to-field"><label htmlFor="taxonomy-category-name">Company label</label><input id="taxonomy-category-name" value={categoryLabel} onChange={(event) => setCategoryLabel(event.target.value)} /></div>
          <div className="to-response-actions">
            <button className="to-button primary" type="button" disabled={!categoryLabel.trim()} onClick={() => onUpdateCategory({ id: selectedCategory.id, label: categoryLabel.trim(), active: selectedCategory.active !== false })}><CheckCircle2 /> Save label</button>
            <button className="to-button ghost" type="button" onClick={() => onUpdateCategory({ id: selectedCategory.id, label: categoryLabel.trim() || selectedCategory.label, active: selectedCategory.active === false })}>{selectedCategory.active === false ? <><RotateCcw /> Restore</> : <><XCircle /> Retire</>}</button>
          </div>
        </div> : null}
        <details className="to-method">
          <summary>Add another service area</summary>
          <div className="to-grid equal">
            <div className="to-field"><label htmlFor="new-category-label">Service-area name</label><input id="new-category-label" value={newCategoryLabel} onChange={(event) => setNewCategoryLabel(event.target.value)} placeholder="Example: Car wash" /></div>
            <div className="to-field"><label htmlFor="new-category-description">Plain-language description</label><input id="new-category-description" value={newCategoryDescription} onChange={(event) => setNewCategoryDescription(event.target.value)} placeholder="What belongs in this service area" /></div>
          </div>
          <button className="to-button primary to-full" type="button" disabled={!newCategoryLabel.trim()} onClick={() => { onCreateCategory({ label: newCategoryLabel.trim(), description: newCategoryDescription.trim() }); setNewCategoryLabel(""); setNewCategoryDescription(""); }}><Plus /> Add company service area</button>
        </details>
      </div>
    </article>

    {selectedCategory ? <article className="to-panel">
      <header className="to-panel-head"><div><h2>{selectedCategory.label} structure</h2><p>Optional nested levels keep every store on the same naming logic.</p></div><span className="to-filter-count">{categoryNodes.filter((node) => node.active !== false).length} active nodes</span></header>
      <div className="to-panel-body">
        <div className="to-field"><label htmlFor="taxonomy-node">Select structure node</label><select id="taxonomy-node" value={selectedNodeId} onChange={(event) => chooseNode(event.target.value)}><option value="">Choose a node to rename or retire</option>{categoryNodes.map((node) => <option value={node.id} key={node.id}>{node.active === false ? "Retired · " : ""}{nodePath(node, byId)} · {node.kind.replaceAll("_", " ")}</option>)}</select></div>
        {selectedNode ? <div className="to-grid equal">
          <div className="to-field"><label htmlFor="taxonomy-node-name">Node label</label><input id="taxonomy-node-name" value={nodeLabel} onChange={(event) => setNodeLabel(event.target.value)} /></div>
          <div className="to-response-actions">
            <button className="to-button primary" type="button" disabled={!nodeLabel.trim()} onClick={() => onUpdateNode({ id: selectedNode.id, label: nodeLabel.trim(), active: selectedNode.active !== false })}><Tag /> Save label</button>
            <button className="to-button ghost" type="button" onClick={() => onUpdateNode({ id: selectedNode.id, label: nodeLabel.trim() || selectedNode.label, active: selectedNode.active === false })}>{selectedNode.active === false ? <><RotateCcw /> Restore</> : <><XCircle /> Retire</>}</button>
          </div>
        </div> : null}

        <div className="to-grid equal">
          <div className="to-field"><label htmlFor="new-node-name">Add a level or equipment type</label><input id="new-node-name" value={newNodeLabel} onChange={(event) => setNewNodeLabel(event.target.value)} placeholder="Example: Walk-in freezers" /></div>
          <div className="to-field"><label htmlFor="new-node-kind">Level type</label><select id="new-node-kind" value={newNodeKind} onChange={(event) => setNewNodeKind(event.target.value as TaxonomyNode["kind"])}><option value="group">Group</option><option value="system">System</option><option value="equipment_type">Equipment type</option></select></div>
          <div className="to-field"><label htmlFor="new-node-parent">Parent level <small>(optional)</small></label><select id="new-node-parent" value={newNodeParentId} onChange={(event) => setNewNodeParentId(event.target.value)}><option value="">Top level under {selectedCategory.label}</option>{categoryNodes.filter((node) => node.active !== false).map((node) => <option value={node.id} key={node.id}>{nodePath(node, byId)}</option>)}</select></div>
        </div>
        <button className="to-button primary to-full" type="button" disabled={!newNodeLabel.trim()} onClick={() => { onCreateNode({ categoryId: selectedCategory.id, parentId: newNodeParentId || undefined, label: newNodeLabel.trim(), kind: newNodeKind }); setNewNodeLabel(""); }}><Plus /> Add to company structure</button>
      </div>
    </article> : null}
  </div>;
}
