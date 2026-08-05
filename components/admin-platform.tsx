"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileSpreadsheet,
  FileText,
  Gauge,
  KeyRound,
  Landmark,
  Layers3,
  MapPin,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Store,
  Tags,
  Upload,
  UsersRound,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  PlatformBadge,
  PlatformBreadcrumbs,
  PlatformPageHeader,
  PlatformSectionHeader,
  PlatformStat,
} from "@/components/platform-ui";
import Link from "@/components/site-link";
import { formatCurrency, formatDate } from "@/lib/domain/analytics";
import { platformData, taxonomyConfiguration } from "@/lib/platform/data";
import { approvalPolicies, budgets, glAccounts } from "@/lib/platform/finance";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AdminSection =
  | "overview"
  | "organization"
  | "people"
  | "taxonomy"
  | "routing"
  | "financial"
  | "imports"
  | "audit";
const adminSections: Array<{
  key: AdminSection;
  label: string;
  icon: typeof Settings2;
}> = [
  { key: "overview", label: "Overview", icon: Gauge },
  { key: "organization", label: "Company & stores", icon: Building2 },
  { key: "people", label: "People & access", icon: UsersRound },
  { key: "taxonomy", label: "Names & categories", icon: Tags },
  { key: "routing", label: "Teams & vendors", icon: Wrench },
  { key: "financial", label: "Spending rules", icon: Landmark },
  { key: "imports", label: "Import data", icon: FileSpreadsheet },
  { key: "audit", label: "History & security", icon: ShieldCheck },
];

export function AdministrationCenter({
  initialSection,
}: {
  initialSection?: string;
}) {
  const normalized = adminSections.some((item) => item.key === initialSection)
    ? (initialSection as AdminSection)
    : "overview";
  const [section, setSection] = useState<AdminSection>(normalized);
  return (
    <AppShell>
      <div className="pf-page admin-page">
        <PlatformPageHeader
          eyebrow="Settings & setup"
          title="Set up how your company works."
          description="Manage stores, people, teams, vendors, spending rules, names, and imports."
        >
          <Link className="pf-secondary-button" href="/vendor-portal">
            <KeyRound />
            View vendor access
          </Link>
          <Link className="pf-primary-button" href="/stores/new">
            <Plus />
            Add a store
          </Link>
        </PlatformPageHeader>
        <div className="admin-layout">
          <aside className="admin-nav">
            {adminSections.map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                className={section === key ? "active" : ""}
                key={key}
                onClick={() => setSection(key)}
              >
                <Icon />
                <span>{label}</span>
                <ChevronRight />
              </button>
            ))}
          </aside>
          <main className="admin-content">
            {section === "overview" && <AdminOverview />}
            {section === "organization" && <OrganizationAdmin />}
            {section === "people" && <PeopleAdmin />}
            {section === "taxonomy" && <TaxonomyAdmin />}
            {section === "routing" && <RoutingAdmin />}
            {section === "financial" && <FinancialAdmin />}
            {section === "imports" && <ImportAdmin />}
            {section === "audit" && <AuditAdmin />}
          </main>
        </div>
      </div>
    </AppShell>
  );
}

function AdminOverview() {
  const modules = [
    {
      icon: Building2,
      title: "Company and stores",
      value: `${platformData.regions.length} regions · ${new Set(platformData.stores.map((store) => store.district)).size} districts · ${platformData.stores.length} showcase stores`,
      status: "Configured",
      note: "Regions are optional. A single store works just as well.",
    },
    {
      icon: Tags,
      title: "Maintenance categories",
      value: `${platformData.categories.length} categories · 4 hierarchy levels`,
      status: "Configured",
      note: "Use the names your company already knows.",
    },
    {
      icon: Wrench,
      title: "Teams and vendors",
      value: `${platformData.vendors.length} outside vendors · 1 internal team`,
      status: "Review",
      note: "Choose who handles each type of work.",
    },
    {
      icon: Landmark,
      title: "Spending and bills",
      value: `${glAccounts.length} accounts · ${approvalPolicies.length} approval rules`,
      status: "Configured",
      note: "Budgets, purchase orders, bills, and payments.",
    },
    {
      icon: UsersRound,
      title: "People and access",
      value: "7 access options · store and region access",
      status: "Review",
      note: "Give each person only the access they need.",
    },
    {
      icon: ShieldCheck,
      title: "History and security",
      value: "Every important change is recorded",
      status: "Configured",
      note: "Important changes keep a permanent history.",
    },
  ];
  return (
    <>
      <section className="pf-stat-grid admin-stat-grid">
        <PlatformStat
          label="Stores ready"
          value="94%"
          note={`11 of ${platformData.stores.length} fully configured`}
          icon={Store}
          tone="positive"
        />
        <PlatformStat
          label="Work types covered"
          value="97%"
          note="2 stores need a work type assigned"
          icon={Wrench}
          tone="warning"
        />
        <PlatformStat
          label="Costs assigned"
          value="99%"
          note="3 cost items need review"
          icon={CircleDollarSign}
          tone="positive"
        />
        <PlatformStat
          label="Next access review"
          value="14 days"
          note="Next quarterly certification"
          icon={KeyRound}
        />
      </section>
      <section className="admin-module-grid">
        {modules.map(({ icon: Icon, title, value, status, note }) => (
          <article key={title}>
            <header>
              <span>
                <Icon />
              </span>
              <PlatformBadge
                tone={status === "Configured" ? "good" : "warning"}
              >
                {status}
              </PlatformBadge>
            </header>
            <h2>{title}</h2>
            <strong>{value}</strong>
            <p>{note}</p>
            <button type="button">
              Review settings
              <ArrowRight />
            </button>
          </article>
        ))}
      </section>
    </>
  );
}

function OrganizationAdmin() {
  return (
    <section className="pf-panel">
      <PlatformSectionHeader
        title="Organization and portfolio hierarchy"
        description="A store belongs directly to the organization; region and district groupings remain optional."
      >
        <Link className="pf-primary-button" href="/stores/new">
          <Plus />
          Create store
        </Link>
      </PlatformSectionHeader>
      <div className="organization-tree">
        <header>
          <span>
            <Building2 />
          </span>
          <div>
            <strong>Clark&apos;s Stores</strong>
            <small>
              Operating organization · {platformData.stores.length} locations
            </small>
          </div>
          <PlatformBadge tone="good">Active tenant</PlatformBadge>
        </header>
        {platformData.regions.map((region) => {
          const stores = platformData.stores.filter(
            (store) => store.regionId === region.id,
          );
          return (
            <article key={region.id}>
              <div>
                <span>
                  <MapPin />
                </span>
                <div>
                  <strong>{region.name}</strong>
                  <small>
                    {stores.length} stores ·{" "}
                    {new Set(stores.map((store) => store.district)).size}{" "}
                    districts
                  </small>
                </div>
                <button>Edit</button>
              </div>
              <div className="organization-store-preview">
                {stores.slice(0, 5).map((store) => (
                  <Link href={`/stores/${store.id}`} key={store.id}>
                    <strong>#{store.code}</strong>
                    <span>{store.city}</span>
                  </Link>
                ))}
                {stores.length > 5 && (
                  <Link href={`/stores?region=${region.id}`}>
                    +{stores.length - 5} more
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PeopleAdmin() {
  const roles = [
    {
      role: "Owner / executive",
      scope: "Organization",
      users: 3,
      rights: "Portfolio, reports, approvals",
    },
    {
      role: "Facilities manager",
      scope: "Organization / region",
      users: 5,
      rights: "Work, providers, assets, finance",
    },
    {
      role: "Regional manager",
      scope: "Assigned regions",
      users: 3,
      rights: "Stores, work, verification, reports",
    },
    {
      role: "Store manager",
      scope: "Assigned stores",
      users: platformData.stores.length,
      rights: "Requests, store work, completion verification",
    },
    {
      role: "Internal maintenance",
      scope: "Assigned regions",
      users: 8,
      rights: "My work, execution, evidence, parts used",
    },
    {
      role: "Accounting reviewer",
      scope: "Organization",
      users: 4,
      rights: "Invoices, allocations, credits, payments",
    },
    {
      role: "Requester",
      scope: "Assigned store",
      users: 286,
      rights: "Submit and follow own requests",
    },
  ];
  return (
    <section className="pf-panel">
      <PlatformSectionHeader
        title="People, roles, and store scope"
        description="Roles are composable. The same person may be an owner, approver, and technician in a single-store company."
      >
        <button className="pf-primary-button">
          <Plus />
          Invite person
        </button>
      </PlatformSectionHeader>
      <table className="pf-table">
        <thead>
          <tr>
            <th>Role template</th>
            <th>Scope model</th>
            <th>People</th>
            <th>Principal permissions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roles.map((item) => (
            <tr key={item.role}>
              <td>
                <strong>{item.role}</strong>
              </td>
              <td>
                <strong>{item.scope}</strong>
              </td>
              <td>
                <strong>{item.users}</strong>
              </td>
              <td>
                <small>{item.rights}</small>
              </td>
              <td>
                <button className="table-action">
                  Manage
                  <ArrowRight />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TaxonomyAdmin() {
  return (
    <>
      <section className="taxonomy-explainer">
        <div>
          <Layers3 />
          <span>
            <strong>Stable semantics underneath</strong>
            <p>
              Canonical concepts preserve reporting and history even when the
              customer changes labels.
            </p>
          </span>
        </div>
        <div>
          <BookOpen />
          <span>
            <strong>Familiar vocabulary on top</strong>
            <p>
              Clark&apos;s can display “Cost center” while another operator uses
              “Equipment group.”
            </p>
          </span>
        </div>
      </section>
      <section className="pf-panel">
        <PlatformSectionHeader
          title="Hierarchy labels"
          description="Changing a display label never changes record identity or historical classification."
        >
          <button className="pf-secondary-button">
            <Save />
            Save labels
          </button>
        </PlatformSectionHeader>
        <table className="pf-table taxonomy-table">
          <thead>
            <tr>
              <th>Canonical level</th>
              <th>Clark&apos;s label</th>
              <th>Example</th>
              <th>Required?</th>
            </tr>
          </thead>
          <tbody>
            {taxonomyConfiguration.levelLabels.map((item, index) => (
              <tr key={item.key}>
                <td>
                  <strong>{item.defaultLabel}</strong>
                  <small>Stable key: {item.key}</small>
                </td>
                <td>
                  <input defaultValue={item.organizationLabel} />
                </td>
                <td>
                  <strong>{item.example}</strong>
                </td>
                <td>
                  <PlatformBadge tone={index === 0 ? "info" : "neutral"}>
                    {index === 0 ? "Expected at triage" : "Optional depth"}
                  </PlatformBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="pf-panel taxonomy-alias-panel">
        <PlatformSectionHeader
          title="Canonical concepts and aliases"
          description="Search and import recognize local, legacy, and vendor terminology."
        >
          <button className="pf-primary-button">
            <Plus />
            Add concept
          </button>
        </PlatformSectionHeader>
        <div>
          {taxonomyConfiguration.aliases.map((item) => (
            <article key={item.canonical}>
              <span>
                <Tags />
              </span>
              <div>
                <strong>{item.canonical}</strong>
                <small>
                  {item.aliases.map((alias) => (
                    <em key={alias}>{alias}</em>
                  ))}
                </small>
              </div>
              <button>Edit mapping</button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function RoutingAdmin() {
  const rows = platformData.categories.map((category, index) => ({
    category,
    primary: platformData.vendors[index % platformData.vendors.length],
    backup: platformData.vendors[(index + 2) % platformData.vendors.length],
    response: index < 2 ? "30 minutes" : index < 7 ? "2 hours" : "4 hours",
    arrival:
      index < 2
        ? "4 hours"
        : index < 7
          ? "Next business day"
          : "2 business days",
    nte: index < 2 ? 750_000 : index < 7 ? 500_000 : 300_000,
  }));
  return (
    <>
      <section className="routing-rule-banner">
        <Clock3 />
        <div>
          <strong>Policies inherit organization → region → store.</strong>
          <p>
            A store override is explicit, dated, and auditable. A decline
            advances to the configured fallback while retaining the original
            deadline.
          </p>
        </div>
      </section>
      <section className="pf-panel">
        <PlatformSectionHeader
          title="Default service routing"
          description="Primary provider, backup coverage, service targets, and not-to-exceed controls."
        >
          <button className="pf-primary-button">
            <Plus />
            Add routing rule
          </button>
        </PlatformSectionHeader>
        <table className="pf-table">
          <thead>
            <tr>
              <th>Service category</th>
              <th>Primary</th>
              <th>Backup</th>
              <th>Response target</th>
              <th>Arrival / action</th>
              <th>Default NTE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category.id}>
                <td>
                  <strong>{row.category.name}</strong>
                </td>
                <td>
                  <Link href={`/providers/${row.primary.id}`}>
                    <strong>{row.primary.shortName}</strong>
                  </Link>
                </td>
                <td>
                  <Link href={`/providers/${row.backup.id}`}>
                    <strong>{row.backup.shortName}</strong>
                  </Link>
                </td>
                <td>
                  <strong>{row.response}</strong>
                </td>
                <td>
                  <strong>{row.arrival}</strong>
                </td>
                <td>
                  <strong>{formatCurrency(row.nte)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function FinancialAdmin() {
  return (
    <>
      <section className="pf-stat-grid admin-stat-grid">
        <PlatformStat
          label="Approved FY26 budget"
          value={formatCurrency(
            budgets.reduce((sum, item) => sum + item.approvedCents, 0),
            true,
          )}
          note={`${budgets.length} regional budgets`}
          icon={CircleDollarSign}
        />
        <PlatformStat
          label="GL mappings"
          value={String(glAccounts.length)}
          note="Maintenance-specific accounts"
          icon={Landmark}
        />
        <PlatformStat
          label="Approval policies"
          value={String(approvalPolicies.length)}
          note="NTE, proposal, PO, invoice"
          icon={ClipboardCheck}
        />
        <PlatformStat
          label="Unmapped allocations"
          value="3"
          note="Visible financial exceptions"
          icon={AlertCircle}
          tone="warning"
        />
      </section>
      <section className="pf-panel">
        <PlatformSectionHeader
          title="Approval policies"
          description="Rules evaluate amount, service category, urgency, scope, and financial stage."
        >
          <button className="pf-primary-button">
            <Plus />
            Add policy
          </button>
        </PlatformSectionHeader>
        <table className="pf-table">
          <thead>
            <tr>
              <th>Policy</th>
              <th>Applies to</th>
              <th>Tiers</th>
              <th>Auto-approval</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {approvalPolicies.map((policy) => (
              <tr key={policy.id}>
                <td>
                  <strong>{policy.name}</strong>
                  <small>{policy.id}</small>
                </td>
                <td>
                  <strong>
                    {[
                      ...(policy.appliesTo.workTypes ?? []),
                      ...(policy.appliesTo.fulfillmentModes ?? []),
                      ...(policy.appliesTo.categoryIds ?? []),
                    ].join(", ") || "All maintenance"}
                  </strong>
                </td>
                <td>
                  <strong>{policy.tiers.length}</strong>
                  <small>
                    {policy.tiers
                      .map(
                        (tier) =>
                          `${formatCurrency(tier.minimumAmountCents)}+ ${tier.requiredApproverRoles.join(" + ")}`,
                      )
                      .join(" · ")}
                  </small>
                </td>
                <td>
                  <strong>
                    {policy.tiers[0]?.minimumAmountCents
                      ? `Below ${formatCurrency(policy.tiers[0].minimumAmountCents)}`
                      : "None"}
                  </strong>
                </td>
                <td>
                  <PlatformBadge tone={policy.active ? "good" : "neutral"}>
                    {policy.active ? "Active" : "Inactive"}
                  </PlatformBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function ImportAdmin() {
  const imports = [
    {
      name: "Clark's store master",
      type: "Stores",
      rows: platformData.stores.length,
      status: "Completed",
      by: "Kedrick McKenzie",
      at: "2026-08-01T13:12:00.000Z",
    },
    {
      name: "HVAC-R asset register",
      type: "Equipment",
      rows: 211,
      status: "Completed with warnings",
      by: "Facilities Data Team",
      at: "2026-08-02T15:40:00.000Z",
    },
    {
      name: "Vendor coverage matrix",
      type: "Provider routing",
      rows: 488,
      status: "Completed",
      by: "Procurement",
      at: "2026-08-03T14:20:00.000Z",
    },
  ];
  return (
    <>
      <section className="import-dropzone">
        <Upload />
        <h2>Import operational records</h2>
        <p>
          Use a template or upload an existing workbook. Mapping, validation,
          preview, row-level errors, and rollback happen before activation.
        </p>
        <div>
          <button className="pf-primary-button">Choose file</button>
          <button className="pf-secondary-button">Download templates</button>
        </div>
      </section>
      <section className="pf-panel">
        <PlatformSectionHeader
          title="Import history"
          description="Every import retains mapping, validation results, author, and rollback window."
        />
        <table className="pf-table">
          <thead>
            <tr>
              <th>Import</th>
              <th>Record type</th>
              <th>Rows</th>
              <th>Status</th>
              <th>Run by</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {imports.map((item) => (
              <tr key={item.name}>
                <td>
                  <strong>{item.name}</strong>
                </td>
                <td>{item.type}</td>
                <td>
                  <strong>{item.rows}</strong>
                </td>
                <td>
                  <PlatformBadge
                    tone={item.status === "Completed" ? "good" : "warning"}
                  >
                    {item.status}
                  </PlatformBadge>
                </td>
                <td>{item.by}</td>
                <td>{formatDate(item.at, true)}</td>
                <td>
                  <button className="table-action">
                    View results
                    <ArrowRight />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function AuditAdmin() {
  const events = platformData.auditEvents
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 25);
  return (
    <>
      <section className="audit-controls">
        <div>
          <ShieldCheck />
          <span>
            <strong>Append-only operational audit</strong>
            <p>
              Original reports, classification changes, deadlines, approvals,
              provider responses, visit evidence, and financial decisions are
              never silently overwritten.
            </p>
          </span>
        </div>
        <button className="pf-secondary-button">
          <FileText />
          Export audit records
        </button>
      </section>
      <section className="pf-panel">
        <PlatformSectionHeader
          title="Recent control events"
          description="Organization-scoped and permission-filtered."
        />
        <table className="pf-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Record</th>
              <th>Actor</th>
              <th>Time</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  <strong>{event.type.replaceAll("_", " ")}</strong>
                </td>
                <td>
                  <strong>
                    {event.entityType.replaceAll("_", " ")} · {event.entityId}
                  </strong>
                </td>
                <td>{event.actor}</td>
                <td>{formatDate(event.at, true)}</td>
                <td>
                  <small>{event.summary}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

type CenterDraft = {
  categoryId: string;
  enabled: boolean;
  name: string;
  codeSuffix: string;
  location: string;
};
const initialCenters: CenterDraft[] = [
  ["refrigeration", true, "Refrigeration", "REF", "Sales floor and back room"],
  ["hvac", true, "Comfort HVAC", "HVAC", "Roof and sales floor"],
  ["foodservice", true, "Foodservice Equipment", "FOOD", "Foodservice line"],
  ["plumbing", true, "Plumbing & Restrooms", "PLUMB", "Restrooms and utility"],
  ["electrical", true, "Electrical & Lighting", "ELEC", "Whole store"],
  ["fuel", true, "Fuel & Forecourt", "FUEL", "Forecourt"],
  ["building", true, "Building & Site", "SITE", "Interior and exterior"],
  ["life-safety", true, "Life Safety", "SAFE", "Whole store"],
  ["grounds", true, "Grounds & Landscape", "GROUNDS", "Exterior site"],
  ["snow", true, "Snow & Ice", "SNOW", "Parking and walks"],
  ["janitorial", true, "Janitorial Services", "JAN", "Whole store"],
  ["pest", true, "Pest Management", "PEST", "Interior and exterior"],
  ["signage", true, "Signage & Branding", "SIGN", "Building and forecourt"],
  ["waste", true, "Waste & Recycling", "WASTE", "Service yard"],
].map(([categoryId, enabled, name, codeSuffix, location]) => ({
  categoryId: String(categoryId),
  enabled: Boolean(enabled),
  name: String(name),
  codeSuffix: String(codeSuffix),
  location: String(location),
}));

export function StoreCommissioningWizard({
  copyStoreId,
  editStoreId,
}: {
  copyStoreId?: string;
  editStoreId?: string;
}) {
  const router = useRouter();
  const copyStore = platformData.stores.find(
    (store) => store.id === copyStoreId,
  );
  const editStore = platformData.stores.find(
    (store) => store.id === editStoreId,
  );
  const [step, setStep] = useState(editStoreId ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storeId, setStoreId] = useState(editStoreId ?? "");
  const [profile, setProfile] = useState({
    code: editStore?.code ?? "",
    name: editStore?.name ?? "",
    address1: editStore?.address1 ?? "",
    city: editStore?.city ?? copyStore?.city ?? "",
    state: editStore?.state ?? copyStore?.state ?? "PA",
    postalCode: editStore?.postalCode ?? "",
    phone: editStore?.phone ?? "",
    managerName: editStore?.managerName ?? "",
    district: editStore?.district ?? copyStore?.district ?? "District 1",
    regionId: editStore?.regionId ?? copyStore?.regionId ?? "region-central",
    squareFeet: String(editStore?.squareFeet ?? copyStore?.squareFeet ?? 4200),
  });
  const [template, setTemplate] = useState("full-service");
  const [centers, setCenters] = useState(initialCenters);
  const [existingCenterCategories, setExistingCenterCategories] = useState(() => new Set(
    editStoreId ? platformData.systems.filter((system) => system.storeId === editStoreId).map((system) => system.categoryId) : [],
  ));
  const [assetMode, setAssetMode] = useState("starter");
  const [providerMode, setProviderMode] = useState("regional");
  const [pmEnabled, setPmEnabled] = useState(true);
  const [financialEnabled, setFinancialEnabled] = useState(true);
  const enabledCenters = centers.filter((center) => center.enabled);
  const steps = [
    "Store basics",
    "Work types",
    "Equipment",
    "Teams & rules",
    "Review",
  ];

  useEffect(() => {
    if (!editStoreId || editStore) return;
    fetch("/api/registry?entity=stores")
      .then((response) => response.json())
      .then((raw) => {
        const result = raw as { records?: Array<Record<string, unknown>> };
        const record = result.records?.find((item) => item.id === editStoreId);
        if (!record) return;
        setProfile((current) => ({
          ...current,
          code: String(record.code ?? ""),
          name: String(record.name ?? ""),
          address1: String(record.address1 ?? ""),
          city: String(record.city ?? ""),
          state: String(record.state ?? "PA"),
          postalCode: String(record.postalCode ?? ""),
          phone: String(record.phone ?? ""),
          managerName: String(record.managerName ?? ""),
          district: String(record.district ?? "District 1"),
          regionId: String(record.regionId ?? "region-central"),
          squareFeet: String(record.squareFeet ?? 0),
        }));
      })
      .catch(() => undefined);
  }, [editStore, editStoreId]);

  useEffect(() => {
    if (!editStoreId) return;
    fetch("/api/registry?entity=cost-centers")
      .then((response) => response.json())
      .then((raw) => {
        const result = raw as { records?: Array<Record<string, unknown>> };
        const categories = (result.records ?? []).filter((item) => item.storeId === editStoreId).map((item) => String(item.categoryId ?? "")).filter(Boolean);
        setExistingCenterCategories((current) => new Set([...current, ...categories]));
      })
      .catch(() => undefined);
  }, [editStoreId]);

  async function post(entity: string, data: Record<string, unknown>) {
    const response = await fetch("/api/registry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, data }),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      id?: string;
      error?: string;
    };
    if (!response.ok || !result.ok)
      throw new Error(result.error ?? "Unable to save record");
    return result;
  }
  async function saveIdentity() {
    setError("");
    if (editStoreId) {
      setStoreId(editStoreId);
      setStep(1);
      return;
    }
    if (
      !profile.code.trim() ||
      !profile.address1.trim() ||
      !profile.city.trim() ||
      !profile.postalCode.trim()
    ) {
      setError(
        "Store number, street address, city, and ZIP code are required.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await post("stores", {
        ...profile,
        name: profile.name.trim() || `Store ${profile.code} - ${profile.city}`,
        squareFeet: Number(profile.squareFeet) || 0,
      });
      setStoreId(String(result.id));
      setStep(1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save the store.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function activate() {
    setBusy(true);
    setError("");
    try {
      for (const center of enabledCenters.filter((item) => !existingCenterCategories.has(item.categoryId)))
        await post("cost-centers", {
          storeId,
          categoryId: center.categoryId,
          code: `${profile.code}-${center.codeSuffix}`,
          name: center.name,
          description: `${center.name} service scope for Store ${profile.code}.`,
          location: center.location,
          glCode:
            platformData.systems.find(
              (system) => system.categoryId === center.categoryId,
            )?.glCode ?? "6199",
          annualBudgetCents: 0,
          ownerName: profile.managerName || "Facilities",
          maintenanceStrategy: ["life-safety", "pest"].includes(
            center.categoryId,
          )
            ? "statutory"
            : "preventive",
        });
      router.push(`/stores/${storeId}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to finish store setup.",
      );
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="pf-page commissioning-page">
        <PlatformBreadcrumbs
          items={[
            { label: "Stores", href: "/stores" },
            { label: "Add a store" },
          ]}
        />
        <PlatformPageHeader
          eyebrow="Store setup"
          title="Add a store now. Finish the details when you are ready."
          description="Save the basics first so the store is searchable and ready for work. Everything after that is optional and can be resumed later."
        />
        <div className="commissioning-stepper">
          {steps.map((label, index) => (
            <div
              className={index < step ? "done" : index === step ? "active" : ""}
              key={label}
            >
              <span>{index < step ? <Check /> : index + 1}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
        <section className="commissioning-workspace">
          {step === 0 && (
            <div className="commissioning-form">
              <header>
                <Store />
                <div>
                  <h2>Store basics</h2>
                  <p>
                    Add the store number, address, and main contact people will
                    use to find this location.
                  </p>
                </div>
              </header>
              <div className="form-grid">
                <Field
                  label="Store number"
                  required
                  value={profile.code}
                  onChange={(value) => setProfile({ ...profile, code: value })}
                  placeholder="156"
                />
                <Field
                  label="Store name"
                  value={profile.name}
                  onChange={(value) => setProfile({ ...profile, name: value })}
                  placeholder="Optional — generated from number and city"
                  wide
                />
                <Field
                  label="Street address"
                  required
                  value={profile.address1}
                  onChange={(value) =>
                    setProfile({ ...profile, address1: value })
                  }
                  placeholder="410 Market Street"
                  wide
                />
                <Field
                  label="City"
                  required
                  value={profile.city}
                  onChange={(value) => setProfile({ ...profile, city: value })}
                />
                <Field
                  label="State"
                  required
                  value={profile.state}
                  onChange={(value) => setProfile({ ...profile, state: value })}
                />
                <Field
                  label="ZIP code"
                  required
                  value={profile.postalCode}
                  onChange={(value) =>
                    setProfile({ ...profile, postalCode: value })
                  }
                />
                <Field
                  label="Phone"
                  value={profile.phone}
                  onChange={(value) => setProfile({ ...profile, phone: value })}
                />
                <Field
                  label="Store manager"
                  value={profile.managerName}
                  onChange={(value) =>
                    setProfile({ ...profile, managerName: value })
                  }
                />
                <label>
                  <span>Region</span>
                  <select
                    value={profile.regionId}
                    onChange={(event) =>
                      setProfile({ ...profile, regionId: event.target.value })
                    }
                  >
                    {platformData.regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="District"
                  value={profile.district}
                  onChange={(value) =>
                    setProfile({ ...profile, district: value })
                  }
                />
                <Field
                  label="Square feet"
                  value={profile.squareFeet}
                  onChange={(value) =>
                    setProfile({ ...profile, squareFeet: value })
                  }
                  type="number"
                />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="commissioning-form">
              <header>
                <Layers3 />
                <div>
                  <h2>Choose the work this store needs</h2>
                  <p>
                    Start with a common set of work types, or choose only the
                    ones that fit this store.
                  </p>
                </div>
              </header>
              <div className="blueprint-choice">
                <button
                  className={template === "full-service" ? "active" : ""}
                  onClick={() => {
                    setTemplate("full-service");
                    setCenters(
                      centers.map((center) => ({ ...center, enabled: true })),
                    );
                  }}
                >
                  <Building2 />
                  <strong>Full convenience store</strong>
                  <small>All maintenance trades · recommended</small>
                </button>
                <button
                  className={template === "core" ? "active" : ""}
                  onClick={() => {
                    setTemplate("core");
                    setCenters(
                      centers.map((center) => ({
                        ...center,
                        enabled: [
                          "refrigeration",
                          "hvac",
                          "foodservice",
                          "plumbing",
                          "electrical",
                          "fuel",
                          "building",
                          "life-safety",
                        ].includes(center.categoryId),
                      })),
                    );
                  }}
                >
                  <Wrench />
                  <strong>Core equipment and building</strong>
                  <small>Eight primary service categories</small>
                </button>
                <button
                  className={template === "blank" ? "active" : ""}
                  onClick={() => {
                    setTemplate("blank");
                    setCenters(
                      centers.map((center) => ({ ...center, enabled: false })),
                    );
                  }}
                >
                  <Plus />
                  <strong>Start blank</strong>
                  <small>Add categories when work occurs</small>
                </button>
              </div>
              <div className="blueprint-category-grid">
                {centers.map((center, index) => (
                  <div
                    className={center.enabled ? "selected" : ""}
                    key={center.categoryId}
                  >
                    <input
                      id={`commission-category-${center.categoryId}`}
                      aria-label={`Enable ${center.name}`}
                      type="checkbox"
                      checked={center.enabled}
                      onChange={(event) =>
                        setCenters(
                          centers.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, enabled: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    <span
                      style={{
                        background: platformData.categories.find(
                          (category) => category.id === center.categoryId,
                        )?.color,
                      }}
                    />
                    <div>
                      <strong>{center.name}</strong>
                      <small>{center.location}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="commissioning-form">
              <header>
                <Boxes />
                <div>
                  <h2>How do you want to add equipment?</h2>
                  <p>
                    Add what you know now, import a list later, or identify
                    equipment as work happens.
                  </p>
                </div>
              </header>
              <div className="onboarding-option-list">
                <button
                  className={assetMode === "starter" ? "active" : ""}
                  onClick={() => setAssetMode("starter")}
                >
                  <CheckCircle2 />
                  <span>
                    <strong>Start with an equipment checklist</strong>
                    <small>
                      Recommended · add each real item when it is confirmed
                    </small>
                  </span>
                </button>
                <button
                  className={assetMode === "import" ? "active" : ""}
                  onClick={() => setAssetMode("import")}
                >
                  <FileSpreadsheet />
                  <span>
                    <strong>Import an equipment list later</strong>
                    <small>Review the file and fix any errors before saving</small>
                  </span>
                </button>
                <button
                  className={assetMode === "later" ? "active" : ""}
                  onClick={() => setAssetMode("later")}
                >
                  <Clock3 />
                  <span>
                    <strong>Add equipment as work happens</strong>
                    <small>
                      A work order only needs a store to get started
                    </small>
                  </span>
                </button>
              </div>
              <div className="progressive-rule">
                <ShieldCheck />
                <div>
                  <strong>You do not need every equipment detail today</strong>
                  <p>
                    The platform will never create fake equipment just to finish
                    setup. You can add or correct details later.
                  </p>
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="commissioning-form">
              <header>
                <Settings2 />
                <div>
                  <h2>Choose teams and spending rules</h2>
                  <p>
                    Use your company defaults or make an exception for this
                    store.
                  </p>
                </div>
              </header>
              <div className="policy-card-grid">
                <article>
                  <UsersRound />
                  <h3>Who handles the work?</h3>
                  <select
                    value={providerMode}
                    onChange={(event) => setProviderMode(event.target.value)}
                  >
                    <option value="regional">
                      Use the regional teams and vendors
                    </option>
                    <option value="store">
                      Choose teams and vendors for this store
                    </option>
                    <option value="internal">
                      Internal maintenance first, vendor fallback
                    </option>
                  </select>
                  <p>
                    {providerMode === "regional"
                      ? "This store will use the current regional choices for each work type."
                      : "Any store-specific choices can be finished after setup."}
                  </p>
                </article>
                <article>
                  <CircleDollarSign />
                  <h3>Spending and bills</h3>
                  <div className="toggle-row">
                    <span>
                      <strong>Use budgets and accounting defaults</strong>
                      <small>
                        Spending limits, approvals, purchase orders, and bills
                      </small>
                    </span>
                    <input
                      id="commission-financial-controls"
                      aria-label="Use budgets and accounting defaults"
                      type="checkbox"
                      checked={financialEnabled}
                      onChange={(event) =>
                        setFinancialEnabled(event.target.checked)
                      }
                    />
                  </div>
                </article>
                <article>
                  <ShieldCheck />
                  <h3>Planned maintenance</h3>
                  <div className="toggle-row">
                    <span>
                      <strong>Use matching maintenance schedules</strong>
                      <small>
                        Only schedules that fit this store will be added
                      </small>
                    </span>
                    <input
                      id="commission-pm-templates"
                      aria-label="Use matching planned maintenance schedules"
                      type="checkbox"
                      checked={pmEnabled}
                      onChange={(event) => setPmEnabled(event.target.checked)}
                    />
                  </div>
                </article>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="commissioning-form commissioning-review">
              <header>
                <ClipboardCheck />
                <div>
                  <h2>Review the store</h2>
                  <p>
                    Check the choices below, then finish setup. You can change
                    them later from the store page.
                  </p>
                </div>
              </header>
              <div className="review-summary-grid">
                <article>
                  <span className="done">
                    <CheckCircle2 />
                  </span>
                  <div>
                    <strong>
                      Store {profile.code} · {profile.city}
                    </strong>
                    <small>
                      {profile.address1}, {profile.state} {profile.postalCode}
                    </small>
                  </div>
                </article>
                <article>
                  <span>{enabledCenters.length}</span>
                  <div>
                    <strong>Work types</strong>
                    <small>
                      {enabledCenters.map((center) => center.name).join(", ")}
                    </small>
                  </div>
                </article>
                <article>
                  <span>
                    <Boxes />
                  </span>
                  <div>
                    <strong>Equipment setup</strong>
                    <small>
                      {assetMode === "starter"
                        ? "Equipment checklist"
                        : assetMode === "import"
                          ? "Import after setup"
                          : "Add during future work"}
                    </small>
                  </div>
                </article>
                <article>
                  <span>
                    <UsersRound />
                  </span>
                  <div>
                    <strong>Teams and vendors</strong>
                    <small>{providerMode.replaceAll("_", " ")}</small>
                  </div>
                </article>
                <article>
                  <span>
                    <CircleDollarSign />
                  </span>
                  <div>
                    <strong>Spending rules</strong>
                    <small>
                      {financialEnabled
                        ? "Budgets, accounting defaults, and approvals"
                        : "Set up later"}
                    </small>
                  </div>
                </article>
                <article>
                  <span>
                    <ShieldCheck />
                  </span>
                  <div>
                    <strong>Planned maintenance</strong>
                    <small>
                      {pmEnabled
                        ? "Matching templates enabled"
                        : "Set up later"}
                    </small>
                  </div>
                </article>
              </div>
            </div>
          )}
          {error && (
            <div className="commissioning-error">
              <AlertCircle />
              {error}
            </div>
          )}
          <footer className="commissioning-actions">
            {step > 0 && (
              <button
                className="pf-secondary-button"
                onClick={() => setStep(step - 1)}
                disabled={busy}
              >
                <ArrowLeft />
                Back
              </button>
            )}
            <span>
              {step === 0
                ? "Store basics are saved before the optional steps."
                : "You can resume setup from the store page."}
            </span>
            {step === 0 ? (
              <button
                className="pf-primary-button"
                onClick={() => void saveIdentity()}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save store and continue"}
                <ArrowRight />
              </button>
            ) : step < 4 ? (
              <button
                className="pf-primary-button"
                onClick={() => setStep(step + 1)}
              >
                Save and continue
                <ArrowRight />
              </button>
            ) : (
              <button
                className="pf-primary-button"
                onClick={() => void activate()}
                disabled={busy}
              >
                {busy ? "Finishing…" : "Finish store setup"}
                <Check />
              </button>
            )}
          </footer>
        </section>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  wide,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
  type?: string;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      <span>
        {label}
        {required && <em>Required</em>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

type SetupEntity = "cost-center" | "asset" | "component";
type SetupStoreRecord = { id: string; code: string; city: string; address1: string };
type SetupSystemRecord = { id: string; storeId: string; code: string; name: string };
type SetupAssetRecord = { id: string; storeSystemId: string; assetTag: string; name: string };

export function EquipmentSetupForm({
  entity,
  initialStoreId,
  initialSystemId,
  initialAssetId,
}: {
  entity: SetupEntity;
  initialStoreId?: string;
  initialSystemId?: string;
  initialAssetId?: string;
}) {
  const router = useRouter();
  const seededInitialAsset = platformData.assets.find((item) => item.id === initialAssetId);
  const seededInitialSystem = platformData.systems.find((item) => item.id === (initialSystemId || seededInitialAsset?.storeSystemId));
  const [storeId, setStoreId] = useState(
    initialStoreId ?? seededInitialSystem?.storeId ?? platformData.stores[0].id,
  );
  const [createdStores, setCreatedStores] = useState<SetupStoreRecord[]>([]);
  const [createdSystems, setCreatedSystems] = useState<SetupSystemRecord[]>([]);
  const [createdAssets, setCreatedAssets] = useState<SetupAssetRecord[]>([]);
  const allStores = [...new Map< string, SetupStoreRecord>([...platformData.stores, ...createdStores].map((item) => [item.id, item])).values()];
  const allSystems = [...new Map<string, SetupSystemRecord>([...platformData.systems, ...createdSystems].map((item) => [item.id, item])).values()];
  const allAssets = [...new Map<string, SetupAssetRecord>([...platformData.assets, ...createdAssets].map((item) => [item.id, item])).values()];
  const availableSystems = allSystems.filter(
    (item) => item.storeId === storeId,
  );
  const [systemId, setSystemId] = useState(
    initialSystemId ?? seededInitialSystem?.id ?? availableSystems[0]?.id ?? "",
  );
  const availableAssets = allAssets.filter(
    (item) => item.storeSystemId === systemId,
  );
  const [assetId, setAssetId] = useState(
    initialAssetId ?? availableAssets[0]?.id ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all(["stores", "cost-centers", "assets"].map(async (entityName) => {
      const response = await fetch(`/api/registry?entity=${entityName}`);
      return await response.json() as { ok?: boolean; records?: Array<Record<string, unknown>> };
    })).then(([storesResult, systemsResult, assetsResult]) => {
      const stores = (storesResult.records ?? []).map((item) => ({ id: String(item.id ?? ""), code: String(item.code ?? ""), city: String(item.city ?? ""), address1: String(item.address1 ?? "") })).filter((item) => item.id);
      const systems = (systemsResult.records ?? []).map((item) => ({ id: String(item.id ?? ""), storeId: String(item.storeId ?? ""), code: String(item.code ?? ""), name: String(item.name ?? "") })).filter((item) => item.id && item.storeId);
      const assets = (assetsResult.records ?? []).map((item) => ({ id: String(item.id ?? ""), storeSystemId: String(item.storeSystemId ?? ""), assetTag: String(item.assetTag ?? ""), name: String(item.name ?? "") })).filter((item) => item.id && item.storeSystemId);
      if (storesResult.ok) setCreatedStores(stores);
      if (systemsResult.ok) setCreatedSystems(systems);
      if (assetsResult.ok) setCreatedAssets(assets);
      const requestedAsset = assets.find((item) => item.id === initialAssetId) ?? (seededInitialAsset ? { id: seededInitialAsset.id, storeSystemId: seededInitialAsset.storeSystemId, assetTag: seededInitialAsset.assetTag, name: seededInitialAsset.name } : undefined);
      const requestedSystem = systems.find((item) => item.id === (initialSystemId || requestedAsset?.storeSystemId)) ?? (seededInitialSystem ? { id: seededInitialSystem.id, storeId: seededInitialSystem.storeId, code: seededInitialSystem.code, name: seededInitialSystem.name } : undefined);
      const resolvedStoreId = initialStoreId || requestedSystem?.storeId || storeId;
      const resolvedSystemId = initialSystemId || requestedSystem?.id || (!initialAssetId ? systemId || systems.find((item) => item.storeId === resolvedStoreId)?.id || platformData.systems.find((item) => item.storeId === resolvedStoreId)?.id : "");
      if (resolvedStoreId && resolvedStoreId !== storeId) setStoreId(resolvedStoreId);
      if (resolvedSystemId && resolvedSystemId !== systemId) setSystemId(resolvedSystemId);
      const resolvedAssetId = initialAssetId || assetId || assets.find((item) => item.storeSystemId === resolvedSystemId)?.id || platformData.assets.find((item) => item.storeSystemId === resolvedSystemId)?.id || "";
      if (resolvedAssetId && resolvedAssetId !== assetId) setAssetId(resolvedAssetId);
    }).catch(() => undefined);
  }, [assetId, initialAssetId, initialStoreId, initialSystemId, seededInitialAsset, seededInitialSystem, storeId, systemId]);
  const title =
    entity === "cost-center"
      ? "Add equipment group"
      : entity === "asset"
        ? "Add equipment"
        : "Add component";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const apiEntity =
      entity === "cost-center"
        ? "cost-centers"
        : entity === "asset"
          ? "assets"
          : "components";
    const payload =
      entity === "cost-center"
        ? {
            ...data,
            storeId,
            annualBudgetCents: Number(data.annualBudget ?? 0) * 100,
          }
        : entity === "asset"
          ? {
              ...data,
              storeSystemId: systemId,
              replacementCostCents: Number(data.replacementCost ?? 0) * 100,
            }
          : {
              ...data,
              assetId,
              quantity: Number(data.quantity ?? 1),
              unitCostCents: Number(data.unitCost ?? 0) * 100,
              criticalSpare: data.criticalSpare === "on",
            };
    try {
      const response = await fetch("/api/registry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity: apiEntity, data: payload }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (!result.ok) throw new Error(result.error ?? "Unable to save");
      router.push(
        entity === "cost-center"
          ? `/stores/${storeId}`
          : entity === "asset"
            ? `/assets/${result.id}`
            : `/components/${result.id}`,
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save");
      setBusy(false);
    }
  }
  return (
    <AppShell>
      <div className="pf-page setup-form-page">
        <PlatformBreadcrumbs
          items={[{ label: "Equipment", href: "/equipment" }, { label: title }]}
        />
        <PlatformPageHeader
          eyebrow="Add equipment"
          title={title}
          description="Add only what you know. You can save work at the store level and fill in equipment details later."
        />
        <form
          className="pf-panel setup-entity-form"
          onSubmit={(event) => void submit(event)}
        >
          <PlatformSectionHeader
            title="Where it is and what it is"
            description="Choose its physical location first. Accounting details stay separate."
          />
          <div className="form-grid">
            <label className="wide">
              <span>Store</span>
              <select
                value={storeId}
                onChange={(event) => {
                  setStoreId(event.target.value);
                  setSystemId(
                    allSystems.find(
                      (item) => item.storeId === event.target.value,
                    )?.id ?? "",
                  );
                }}
              >
                {allStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    #{store.code} · {store.city} · {store.address1}
                  </option>
                ))}
              </select>
            </label>
            {entity !== "cost-center" && (
              <label className="wide">
                <span>Equipment group</span>
                <select
                  value={systemId}
                  onChange={(event) => {
                    setSystemId(event.target.value);
                    setAssetId(
                      allAssets.find(
                        (item) => item.storeSystemId === event.target.value,
                      )?.id ?? "",
                    );
                  }}
                >
                  {availableSystems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.code} · {system.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {entity === "component" && (
              <label className="wide">
                <span>Parent equipment</span>
                <select
                  value={assetId}
                  onChange={(event) => setAssetId(event.target.value)}
                >
                  {availableAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.assetTag} · {asset.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {entity === "cost-center" && (
              <>
                <label>
                  <span>Service category</span>
                  <select name="categoryId">
                    {platformData.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <FieldInput
                  label="Code"
                  name="code"
                  required
                  placeholder="156-REF"
                />
                <FieldInput
                  label="Name"
                  name="name"
                  required
                  placeholder="Refrigeration"
                />
                <FieldInput
                  label="Type"
                  name="type"
                  required
                  placeholder="Coolers, freezers & ice"
                />
                <FieldInput
                  label="Physical location"
                  name="location"
                  placeholder="Sales floor and back room"
                />
                <FieldInput label="GL code" name="glCode" placeholder="6110" />
                <FieldInput
                  label="Annual budget ($)"
                  name="annualBudget"
                  type="number"
                />
                <FieldInput label="Responsible owner" name="ownerName" />
                <label>
                  <span>Maintenance strategy</span>
                  <select name="maintenanceStrategy">
                    <option value="preventive">Preventive</option>
                    <option value="condition_based">Condition based</option>
                    <option value="run_to_failure">Run to failure</option>
                    <option value="statutory">Statutory</option>
                  </select>
                </label>
                <label className="wide">
                  <span>Description</span>
                  <textarea name="description" />
                </label>
              </>
            )}
            {entity === "asset" && (
              <>
                <FieldInput
                  label="Asset tag"
                  name="assetTag"
                  required
                  placeholder="156-WIC-01"
                />
                <FieldInput
                  label="Equipment name"
                  name="name"
                  required
                  placeholder="Beer Cave Walk-In Cooler"
                />
                <FieldInput
                  label="Equipment class"
                  name="assetClass"
                  required
                  placeholder="Walk-In Cooler"
                />
                <FieldInput label="Manufacturer" name="manufacturer" />
                <FieldInput label="Model" name="model" />
                <FieldInput label="Serial number" name="serial" />
                <FieldInput label="Physical location" name="location" />
                <FieldInput
                  label="Installed date"
                  name="installedAt"
                  type="date"
                />
                <FieldInput
                  label="Replacement estimate ($)"
                  name="replacementCost"
                  type="number"
                />
                <label>
                  <span>Criticality</span>
                  <select name="criticality">
                    <option value="standard">Standard</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </>
            )}
            {entity === "component" && (
              <>
                <FieldInput
                  label="Component name"
                  name="name"
                  required
                  placeholder="Temperature controller"
                />
                <FieldInput
                  label="Component type"
                  name="type"
                  required
                  placeholder="Controller"
                />
                <FieldInput label="Part number" name="partNumber" />
                <FieldInput label="Serial number" name="serial" />
                <FieldInput
                  label="Quantity"
                  name="quantity"
                  type="number"
                  defaultValue="1"
                />
                <FieldInput
                  label="Reference unit cost ($)"
                  name="unitCost"
                  type="number"
                />
                <FieldInput
                  label="Installed date"
                  name="installedAt"
                  type="date"
                />
                <FieldInput
                  label="Warranty end"
                  name="warrantyEndsAt"
                  type="date"
                />
                <div className="check-field wide">
                  <input id="critical-spare" aria-label="Mark as critical spare" type="checkbox" name="criticalSpare" />
                  <span>
                    <strong>Critical spare</strong>
                    <small>
                      Flag for planning and reporting; this does not create
                      inventory.
                    </small>
                  </span>
                </div>
              </>
            )}
          </div>
          <footer className="form-actions">
            {message && (
              <span className="form-error">
                <AlertCircle />
                {message}
              </span>
            )}
            <Link className="pf-secondary-button" href="/equipment">
              Cancel
            </Link>
            <button className="pf-primary-button" disabled={busy} type="submit">
              {busy ? "Saving…" : `Create ${entity.replace("-", " ")}`}
              <Save />
            </button>
          </footer>
        </form>
      </div>
    </AppShell>
  );
}
function FieldInput({
  label,
  name,
  required,
  placeholder,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label>
      <span>
        {label}
        {required && <em>Required</em>}
      </span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        type={type}
        defaultValue={defaultValue}
      />
    </label>
  );
}
