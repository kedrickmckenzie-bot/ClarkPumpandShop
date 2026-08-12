import "server-only";

import { notFound } from "next/navigation";
import type { DetailPageViewModel, OperatorRole, OperatorSession, TableRowViewModel, Tone } from "@/components/ops/data-contract";
import type {
  AddComponentSetupModel,
  CreateAssetSetupModel,
  CreatePmSetupModel,
  SetupOption,
} from "@/components/ops/setup-types";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import type { OpsFixture, Store, TaxonomyNode } from "@/lib/ops/types";
import { loadOperatorSession } from "./operator-loader";

type Query = Record<string, string | string[] | undefined>;
const setupRoles: readonly OperatorRole[] = ["facilities", "regional", "store_manager"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function requireRole(session: OperatorSession, allowed: readonly OperatorRole[]) {
  if (!allowed.includes(session.role)) notFound();
}

function storeAllowed(session: OperatorSession, store: Store) {
  if (store.organizationId !== session.organizationId) return false;
  if (session.storeIds?.length && !session.storeIds.includes(store.id)) return false;
  if (session.regionIds?.length && (!store.regionId || !session.regionIds.includes(store.regionId))) return false;
  if (session.role === "store_manager" && !session.storeIds?.length) return false;
  if (session.role === "regional" && !session.regionIds?.length) return false;
  return true;
}

async function setupContext(allowed: readonly OperatorRole[] = setupRoles) {
  const session = await loadOperatorSession();
  requireRole(session, allowed);
  const fixture = await getServerOpsFixtureSnapshot(session.organizationId);
  return { session, fixture };
}

function storeLabel(store: Store) {
  return `Store ${store.storeNumber} · ${store.name}`;
}

function storeOptions(fixture: OpsFixture, session: OperatorSession): SetupOption[] {
  return fixture.stores
    .filter((store) => storeAllowed(session, store) && store.status === "active")
    .sort((a, b) => a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true }))
    .map((store) => ({
      value: store.id,
      label: storeLabel(store),
      description: `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`,
    }));
}

function categories(fixture: OpsFixture, organizationId: string): SetupOption[] {
  return fixture.taxonomyNodes
    .filter((node) => node.organizationId === organizationId && node.nodeKind === "category" && node.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((node) => ({ value: node.canonicalKey ?? node.id, label: node.name, description: node.aliases.join(", ") }));
}

function taxonomyPath(node: TaxonomyNode, byId: Map<string, TaxonomyNode>) {
  const path: TaxonomyNode[] = [node];
  let current = node;
  const seen = new Set([node.id]);
  while (current.parentNodeId) {
    const parent = byId.get(current.parentNodeId);
    if (!parent || seen.has(parent.id)) break;
    path.unshift(parent);
    seen.add(parent.id);
    current = parent;
  }
  return path;
}

function groupPathOptions(fixture: OpsFixture, organizationId: string): SetupOption[] {
  const nodes = fixture.taxonomyNodes.filter((node) => node.organizationId === organizationId && node.active);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes
    .filter((node) => node.nodeKind === "group")
    .map((node) => taxonomyPath(node, byId))
    .map((path) => {
      const groupNames = path.filter((node) => node.nodeKind === "group").map((node) => node.name);
      const category = path.find((node) => node.nodeKind === "category");
      return {
        value: groupNames.join(" > "),
        label: `${category?.name ?? "Service area"} · ${groupNames.join(" › ")}`,
        description: category?.name,
      };
    });
}

export async function loadCreateAssetSetupModel(query: Query = {}): Promise<CreateAssetSetupModel> {
  const { session, fixture } = await setupContext();
  const stores = storeOptions(fixture, session);
  const requestedStoreId = first(query.store);
  return {
    title: "Add equipment",
    eyebrow: "Store setup",
    description: "Create the equipment identity once, then connect components, preventive maintenance, work history, warranty, and lifecycle evidence as the record grows.",
    scopeLabel: session.scopeLabel,
    submitAction: "/api/ops/equipment",
    cancelHref: requestedStoreId ? `/app/stores/${encodeURIComponent(requestedStoreId)}` : "/app/equipment",
    cancelLabel: requestedStoreId ? "Back to store" : "Back to equipment",
    stores,
    categories: categories(fixture, session.organizationId),
    groupPaths: groupPathOptions(fixture, session.organizationId),
    statusOptions: [
      { value: "operational", label: "Operational" },
      { value: "watch", label: "Watch / review" },
      { value: "out_of_service", label: "Out of service" },
      { value: "retired", label: "Retired" },
    ],
    defaultStoreId: stores.some((option) => option.value === requestedStoreId) ? requestedStoreId : undefined,
  };
}

export async function loadAddComponentSetupModel(
  assetId: string,
  query: Query = {},
): Promise<AddComponentSetupModel> {
  const { session, fixture } = await setupContext();
  const asset = fixture.assets.find(
    (item) => item.organizationId === session.organizationId && item.id === assetId,
  );
  const store = asset && fixture.stores.find(
    (item) => item.organizationId === session.organizationId && item.id === asset.storeId,
  );
  if (!asset || !store || !storeAllowed(session, store)) notFound();
  const components = fixture.components
    .filter((component) => component.organizationId === session.organizationId && component.assetId === asset.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const requestedParentId = first(query.parent);
  return {
    title: "Add component",
    eyebrow: "Equipment structure",
    description: "Add only the component depth that helps identify repeat work, warranty coverage, and repair history. Components can be nested to match the equipment.",
    scopeLabel: `${storeLabel(store)} · ${asset.name}`,
    submitAction: `/api/ops/equipment/${encodeURIComponent(asset.id)}/components`,
    cancelHref: `/app/equipment/${encodeURIComponent(asset.id)}#components`,
    cancelLabel: "Back to equipment",
    assetId: asset.id,
    assetName: asset.name,
    assetTag: asset.assetTag,
    storeLabel: storeLabel(store),
    parents: components.map((component) => ({
      value: component.id,
      label: component.name,
      description: [component.partNumber, component.serialNumber].filter(Boolean).join(" · ") || "Tracked component",
    })),
    defaultParentId: components.some((component) => component.id === requestedParentId)
      ? requestedParentId
      : undefined,
  };
}

export async function loadCreatePmSetupModel(query: Query = {}): Promise<CreatePmSetupModel> {
  const { session, fixture } = await setupContext();
  const stores = fixture.stores.filter((store) => storeAllowed(session, store) && store.status === "active");
  const visibleStoreIds = new Set(stores.map((store) => store.id));
  const assets = fixture.assets
    .filter((asset) => asset.organizationId === session.organizationId && visibleStoreIds.has(asset.storeId) && asset.status !== "retired")
    .sort((a, b) => a.name.localeCompare(b.name));
  const requestedAssetId = first(query.asset);
  const requestedAsset = assets.find((asset) => asset.id === requestedAssetId);
  const requestedStoreId = first(query.store);
  const defaultStoreId = requestedAsset?.storeId ?? (visibleStoreIds.has(requestedStoreId ?? "") ? requestedStoreId : undefined);
  return {
    title: "Create PM plan",
    eyebrow: "Preventive maintenance",
    description: "Define the cadence and completion window, then create the first source occurrence immediately so due work and compliance are visible from day one.",
    scopeLabel: session.scopeLabel,
    submitAction: "/api/ops/pm-plans",
    cancelHref: "/app/pm",
    cancelLabel: "Back to preventive maintenance",
    stores: stores
      .sort((a, b) => a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true }))
      .map((store) => ({ value: store.id, label: storeLabel(store) })),
    assets: assets.map((asset) => {
      const store = stores.find((item) => item.id === asset.storeId);
      return {
        value: asset.id,
        label: `${store ? storeLabel(store) : "Unknown store"} · ${asset.name} · ${asset.assetTag}`,
        description: sentence(asset.categoryKey),
      };
    }),
    categories: categories(fixture, session.organizationId),
    defaultStoreId,
    defaultAssetId: requestedAsset?.id,
    defaultCategoryKey: requestedAsset?.categoryKey,
  };
}

function sentence(value: string | undefined) {
  if (!value) return "Not entered";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"));
}

function date(value: string | undefined) {
  if (!value) return "Not entered";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function dateTime(value: string | undefined) {
  if (!value) return "Not entered";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);
}

function duration(seconds: number | undefined) {
  if (seconds === undefined) return "Active visit";
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min observed`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min observed`;
}

function statusTone(status: string): Tone {
  if (["closed", "completed_pending_review", "completed", "resolved"].includes(status)) return "positive";
  if (["cancelled", "declined", "unable_to_complete"].includes(status)) return "critical";
  if (["waiting_on_parts", "waiting_on_vendor", "diagnosed_waiting_parts", "return_required"].includes(status)) return "warning";
  return "info";
}

export async function loadComponentDetailModel(
  assetId: string,
  componentId: string,
): Promise<DetailPageViewModel> {
  const { session, fixture } = await setupContext(["executive", "facilities", "regional", "store_manager", "finance"]);
  const asset = fixture.assets.find(
    (item) => item.organizationId === session.organizationId && item.id === assetId,
  );
  const store = asset && fixture.stores.find(
    (item) => item.organizationId === session.organizationId && item.id === asset.storeId,
  );
  const component = fixture.components.find(
    (item) => item.organizationId === session.organizationId && item.id === componentId && item.assetId === asset?.id,
  );
  if (!asset || !store || !component || !storeAllowed(session, store)) notFound();

  const allComponents = fixture.components.filter(
    (item) => item.organizationId === session.organizationId && item.assetId === asset.id,
  );
  const parent = component.parentComponentId
    ? allComponents.find((item) => item.id === component.parentComponentId)
    : undefined;
  const children = allComponents.filter((item) => item.parentComponentId === component.id);
  const workOrders = fixture.workOrders
    .filter((work) => work.organizationId === session.organizationId && work.componentId === component.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const workIds = new Set(workOrders.map((work) => work.id));
  const visits = fixture.visits
    .filter((visit) => visit.organizationId === session.organizationId && Boolean(visit.workOrderId && workIds.has(visit.workOrderId)))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  const recordedCostMinor = fixture.costLines
    .filter((cost) => cost.organizationId === session.organizationId && workIds.has(cost.workOrderId))
    .reduce((sum, cost) => sum + cost.amount.amountMinor, 0);
  const canSetup = setupRoles.includes(session.role);
  const canCreateWork = session.role === "facilities" || session.role === "regional";
  const childRows: TableRowViewModel[] = children.map((child) => ({
    id: child.id,
    label: child.name,
    href: `/app/equipment/${encodeURIComponent(asset.id)}/components/${encodeURIComponent(child.id)}`,
    cells: [
      { key: "component", value: child.name },
      { key: "part", value: child.partNumber ?? "Part not entered", secondary: child.serialNumber ? `S/N ${child.serialNumber}` : "Serial not entered" },
      { key: "installed", value: date(child.installedAt) },
      { key: "warranty", value: date(child.warrantyEndsAt) },
    ],
  }));

  return {
    state: { kind: "ready" },
    page: {
      title: component.name,
      eyebrow: `${sentence(asset.categoryKey)} / ${asset.name}`,
      description: "Component identity, nested structure, service work, observed visits, warranty, and recorded cost stay connected to one reviewable record.",
      scopeLabel: storeLabel(store),
      primaryAction: canSetup
        ? { label: "Add child component", href: `/app/equipment/${encodeURIComponent(asset.id)}/components/new?parent=${encodeURIComponent(component.id)}` }
        : undefined,
      secondaryAction: canCreateWork
        ? { label: "Create work order", href: `/app/work-orders/new?store=${encodeURIComponent(store.id)}&asset=${encodeURIComponent(asset.id)}&component=${encodeURIComponent(component.id)}` }
        : undefined,
    },
    statusLabel: "Tracked component",
    statusTone: "info",
    facts: [
      { label: "Equipment", value: `${asset.name} · ${asset.assetTag}`, link: { href: `/app/equipment/${asset.id}`, label: "Open equipment" } },
      {
        label: "Parent",
        value: parent?.name ?? asset.name,
        link: parent
          ? { href: `/app/equipment/${asset.id}/components/${parent.id}`, label: "Open parent component" }
          : { href: `/app/equipment/${asset.id}`, label: "Open equipment" },
      },
      { label: "Part number", value: component.partNumber ?? "Not entered" },
      { label: "Serial number", value: component.serialNumber ?? "Not entered" },
      { label: "Installed", value: date(component.installedAt) },
      {
        label: "Warranty",
        value: date(component.warrantyEndsAt),
        helperText: component.warrantyEndsAt && Date.parse(component.warrantyEndsAt) < Date.parse(fixture.asOf)
          ? "Expired as of this view"
          : "Review coverage before authorizing work",
      },
      { label: "Linked work orders", value: String(workOrders.length) },
      { label: "Recorded work cost", value: money(recordedCostMinor), helperText: "Entered cost lines on component-linked work only" },
    ],
    sections: [
      {
        id: "child-components",
        title: "Child components",
        description: children.length
          ? "Select a child to continue down the equipment structure."
          : "No child components have been added. Deeper setup remains optional.",
        action: canSetup
          ? { label: "Add child component", href: `/app/equipment/${asset.id}/components/new?parent=${component.id}` }
          : undefined,
        table: childRows.length ? {
          id: "child-components",
          caption: `Components nested below ${component.name}`,
          columns: [
            { key: "component", label: "Component" },
            { key: "part", label: "Part / serial" },
            { key: "installed", label: "Installed" },
            { key: "warranty", label: "Warranty" },
          ],
          rows: childRows,
        } : undefined,
      },
      {
        id: "component-work",
        title: "Related work orders",
        description: "Only work explicitly classified to this component appears here.",
        action: canCreateWork
          ? { label: "Create work order", href: `/app/work-orders/new?store=${store.id}&asset=${asset.id}&component=${component.id}` }
          : undefined,
        table: {
          id: "component-work-orders",
          caption: `Work orders for ${component.name}`,
          columns: [
            { key: "work", label: "Work order" },
            { key: "problem", label: "Problem" },
            { key: "created", label: "Created" },
            { key: "cost", label: "Recorded cost", align: "end" },
            { key: "status", label: "Status" },
          ],
          rows: workOrders.map((work) => {
            const cost = fixture.costLines
              .filter((line) => line.organizationId === session.organizationId && line.workOrderId === work.id)
              .reduce((sum, line) => sum + line.amount.amountMinor, 0);
            return {
              id: work.id,
              label: work.number,
              href: `/app/work-orders/${work.id}`,
              cells: [
                { key: "work", value: work.number, secondary: sentence(work.priority) },
                { key: "problem", value: work.problem },
                { key: "created", value: date(work.createdAt) },
                { key: "cost", value: money(cost) },
                { key: "status", value: sentence(work.status), tone: statusTone(work.status) },
              ],
            };
          }),
        },
      },
      {
        id: "component-visits",
        title: "Observed service visits",
        description: "Observed onsite duration is approximate presence evidence, not certified labor or automatic invoice proof.",
        table: {
          id: "component-visits",
          caption: `Observed visits tied to ${component.name}`,
          columns: [
            { key: "visit", label: "Visit" },
            { key: "provider", label: "Provider / technician" },
            { key: "work", label: "Work order" },
            { key: "outcome", label: "Outcome" },
            { key: "presence", label: "Observed presence" },
          ],
          rows: visits.map((visit) => ({
            id: visit.id,
            label: `Visit ${visit.id}`,
            href: `/app/visits?visit=${encodeURIComponent(visit.id)}`,
            cells: [
              { key: "visit", value: dateTime(visit.checkedInAt), secondary: sentence(visit.startedChannel) },
              { key: "provider", value: visit.providerName, secondary: visit.technicianName },
              { key: "work", value: workOrders.find((work) => work.id === visit.workOrderId)?.number ?? "Not linked" },
              { key: "outcome", value: sentence(visit.outcome ?? visit.status), tone: statusTone(visit.outcome ?? visit.status) },
              { key: "presence", value: duration(visit.observedDurationSeconds) },
            ],
          })),
        },
      },
    ],
    backLink: { label: `Back to ${asset.name}`, href: `/app/equipment/${asset.id}#components` },
  };
}
