import "server-only";

import { notFound } from "next/navigation";
import type { DetailPageViewModel, OperatorSession, TableRowViewModel, Tone } from "@/components/ops/data-contract";
import {
  roleCan,
  roleCanAccessDetailRoute,
  type OperatorCapability,
} from "@/components/ops/role-policy";
import type {
  AddComponentSetupModel,
  CreateAssetSetupModel,
  CreatePmProgramSetupModel,
  CreatePmSetupModel,
  PmPlanScheduleSetupModel,
  SetupOption,
} from "@/components/ops/setup-types";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import type { OpsFixture, Store, TaxonomyNode } from "@/lib/ops/types";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDate, formatOperationsDateTime } from "@/lib/ops/local-time";
import { loadOperatorSession } from "./operator-loader";

type Query = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function storeAllowed(session: OperatorSession, store: Store) {
  if (store.organizationId !== session.organizationId) return false;
  if (session.storeIds?.length && !session.storeIds.includes(store.id)) return false;
  if (session.regionIds?.length && (!store.regionId || !session.regionIds.includes(store.regionId))) return false;
  if (session.role === "store_manager" && !session.storeIds?.length) return false;
  if (session.role === "regional" && !session.regionIds?.length) return false;
  return true;
}

async function setupContext(capability: OperatorCapability) {
  const session = await loadOperatorSession();
  if (!roleCan(session, capability)) notFound();
  const fixture = await getServerOpsFixtureSnapshot(session.organizationId);
  return { session, fixture };
}

async function equipmentDetailContext() {
  const session = await loadOperatorSession();
  if (!roleCanAccessDetailRoute(session.role, "equipment")) notFound();
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
  const { session, fixture } = await setupContext("setup_equipment");
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
  const { session, fixture } = await setupContext("setup_equipment");
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
    cancelHref: `/app/equipment/${encodeURIComponent(asset.id)}?section=components`,
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
  const { session, fixture } = await setupContext("setup_pm");
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

export async function loadCreatePmProgramSetupModel(): Promise<CreatePmProgramSetupModel> {
  const { session, fixture } = await setupContext("setup_pm");
  if (session.role !== "executive" && session.role !== "facilities") notFound();
  const nodes = fixture.taxonomyNodes.filter((node) => node.organizationId === session.organizationId && node.active);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return {
    title: "Create company PM schedule",
    eyebrow: "Preventive maintenance standards",
    description: "Choose the company equipment types once. Matching equipment across every store joins the schedule now, and future equipment joins automatically.",
    scopeLabel: session.scopeLabel,
    submitAction: "/api/ops/pm-programs",
    cancelHref: "/app/pm",
    cancelLabel: "Back to preventive maintenance",
    equipmentTypes: fixture.equipmentTemplates
      .filter((template) => template.organizationId === session.organizationId && template.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((template) => {
        const path = taxonomyPath(byId.get(template.taxonomyNodeId)!, byId);
        return {
          value: template.id,
          label: template.name,
          description: path.map((node) => node.name).join(" › "),
        };
      }),
  };
}

export async function loadPmPlanScheduleSetupModel(planId: string): Promise<PmPlanScheduleSetupModel> {
  const { session, fixture } = await setupContext("setup_pm");
  const plan = fixture.pmPlans.find((row) => row.organizationId === session.organizationId && row.id === planId);
  const store = plan?.storeId
    ? fixture.stores.find((row) => row.organizationId === session.organizationId && row.id === plan.storeId)
    : undefined;
  if (!plan || !store || !storeAllowed(session, store)) notFound();
  const asset = plan.assetId
    ? fixture.assets.find((row) => row.organizationId === session.organizationId && row.id === plan.assetId)
    : undefined;
  const program = plan.programId
    ? fixture.maintenancePrograms.find((row) => row.organizationId === session.organizationId && row.id === plan.programId)
    : undefined;
  return {
    title: "Adjust this store's PM schedule",
    eyebrow: "Store-level exception",
    description: "Keep the company standard intact while documenting why this store needs a different future cadence.",
    scopeLabel: `${storeLabel(store)} · ${asset?.name ?? plan.name}`,
    submitAction: `/api/ops/pm-plans/${encodeURIComponent(plan.id)}/schedule`,
    cancelHref: `/app/pm?store=${encodeURIComponent(store.id)}`,
    cancelLabel: "Back to store PM",
    planId: plan.id,
    planName: plan.name,
    storeLabel: storeLabel(store),
    assetLabel: asset ? `${asset.name} · ${asset.assetTag}` : plan.name,
    masterProgramName: program?.name,
    masterCadenceDays: program?.frequencyDays,
    masterWindowDays: program?.dueWindowDays,
    cadenceDays: plan.cadenceDays,
    completionWindowDays: plan.completionWindowDays,
    overrideReason: plan.cadenceOverrideReason,
  };
}

function sentence(value: string | undefined) {
  if (!value) return "Not entered";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"));
}

function date(value: string | undefined) {
  if (!value) return "Not entered";
  return formatOperationsDate(value, DEFAULT_OPERATIONS_TIME_ZONE);
}

function dateTime(value: string | undefined, timeZone = DEFAULT_OPERATIONS_TIME_ZONE) {
  if (!value) return "Not entered";
  return formatOperationsDateTime(value, timeZone);
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
  const { session, fixture } = await equipmentDetailContext();
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
  const visitWorkByVisit = new Map<string, typeof fixture.siteVisitWorkOrders>();
  fixture.siteVisitWorkOrders
    .filter((link) => link.organizationId === session.organizationId && workIds.has(link.workOrderId))
    .forEach((link) => visitWorkByVisit.set(link.visitId, [...(visitWorkByVisit.get(link.visitId) ?? []), link]));
  const visits = fixture.visits
    .filter(
      (visit) =>
        visit.organizationId === session.organizationId &&
        (visitWorkByVisit.has(visit.id) || Boolean(visit.workOrderId && workIds.has(visit.workOrderId))),
    )
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  const recordedCostMinor = fixture.costLines
    .filter((cost) => cost.organizationId === session.organizationId && workIds.has(cost.workOrderId))
    .reduce((sum, cost) => sum + cost.amount.amountMinor, 0);
  const replacementEvents = fixture.componentLifecycleEvents.filter(
    (event) =>
      event.organizationId === session.organizationId &&
      (event.removedComponentId === component.id || event.installedComponentId === component.id),
  );
  const canSetup = roleCan(session, "setup_equipment");
  const canCreateWork = roleCan(session, "create_work_order");
  const childRows: TableRowViewModel[] = children.map((child) => {
    const childWork = fixture.workOrders.filter(
      (work) => work.organizationId === session.organizationId && work.componentId === child.id,
    );
    const childWorkIds = new Set(childWork.map((work) => work.id));
    const childCostMinor = fixture.costLines
      .filter((cost) => cost.organizationId === session.organizationId && childWorkIds.has(cost.workOrderId))
      .reduce((sum, cost) => sum + cost.amount.amountMinor, 0);
    const childReplacementCount = fixture.componentLifecycleEvents.filter(
      (event) =>
        event.organizationId === session.organizationId &&
        (event.removedComponentId === child.id || event.installedComponentId === child.id),
    ).length;
    return {
      id: child.id,
      label: child.name,
      href: `/app/equipment/${encodeURIComponent(asset.id)}/components/${encodeURIComponent(child.id)}`,
      cells: [
        { key: "component", value: child.name },
        { key: "part", value: child.partNumber ?? "Part not entered", secondary: child.serialNumber ? `S/N ${child.serialNumber}` : "Serial not entered" },
        { key: "installed", value: date(child.installedAt) },
        { key: "warranty", value: date(child.warrantyEndsAt) },
        { key: "work", value: String(childWork.length), secondary: childReplacementCount ? `${childReplacementCount} replacement record${childReplacementCount === 1 ? "" : "s"}` : "No replacement recorded" },
        { key: "cost", value: money(childCostMinor), secondary: "Recorded work cost" },
      ],
    };
  });

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
    statusLabel: component.removedAt ? "Removed component" : "Active component",
    statusTone: component.removedAt ? "warning" : "info",
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
      { label: "Removed", value: date(component.removedAt), helperText: component.replacedByComponentId ? "Superseded by a separately tracked installed Component" : "Current unless a removal is recorded" },
      {
        label: "Warranty",
        value: date(component.warrantyEndsAt),
        helperText: component.warrantyEndsAt && Date.parse(component.warrantyEndsAt) < Date.parse(fixture.asOf)
          ? "Expired as of this view"
          : "Review coverage before authorizing work",
      },
      { label: "Linked work orders", value: String(workOrders.length), helperText: "Work explicitly classified to this component" },
      { label: "Recorded work cost", value: money(recordedCostMinor), helperText: "Entered cost lines on component-linked work only" },
      {
        label: "Replacement history",
        value: replacementEvents.length ? `${replacementEvents.length} recorded event${replacementEvents.length === 1 ? "" : "s"}` : "No replacement recorded",
        helperText: "Removed and installed component identity remains attached to the source work order",
        link: replacementEvents.length ? { href: `/app/equipment/${asset.id}/components/${component.id}#component-life`, label: "Open replacement history" } : undefined,
      },
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
            { key: "work", label: "Linked work", align: "end" },
            { key: "cost", label: "Recorded cost", align: "end" },
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
          rows: visits.map((visit) => {
            const links = visitWorkByVisit.get(visit.id) ?? [];
            const linkedWorkIds = new Set([
              ...links.map((link) => link.workOrderId),
              ...(visit.workOrderId && workIds.has(visit.workOrderId) ? [visit.workOrderId] : []),
            ]);
            const linkedWorkNumbers = workOrders.filter((work) => linkedWorkIds.has(work.id)).map((work) => work.number);
            const outcomes = links.map((link) => link.outcome).filter((value): value is NonNullable<typeof value> => Boolean(value));
            const notes = links.map((link) => link.outcomeNotes?.trim()).filter((value): value is string => Boolean(value));
            const outcome = outcomes[0] ?? visit.outcome ?? visit.status;
            return {
              id: visit.id,
              label: `Visit ${visit.id}`,
              href: `/app/visits/${encodeURIComponent(visit.id)}`,
              cells: [
                { key: "visit", value: dateTime(visit.checkedInAt, store?.timeZone), secondary: `${sentence(visit.startedChannel)} · store-local time` },
                { key: "provider", value: visit.providerName, secondary: visit.technicianName },
                { key: "work", value: linkedWorkNumbers.join(" · ") || "Not linked" },
                { key: "outcome", value: sentence(outcome), secondary: notes.join(" · ") || visit.outcomeNotes?.trim() || "No checkout note recorded", tone: statusTone(outcome) },
                { key: "presence", value: duration(visit.observedDurationSeconds) },
              ],
            };
          }),
        },
      },
    ],
    backLink: { label: `Back to ${asset.name} components`, href: `/app/equipment/${asset.id}?section=components` },
  };
}
