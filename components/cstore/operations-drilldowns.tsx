"use client";

import { useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Store as StoreIcon,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";

import type {
  DemoDataset,
  ExceptionRecord,
  ExceptionType,
  Visit,
  VisitChannel,
} from "../../lib/cstore/types";
import styles from "./operations-drilldowns.module.css";

export type OperationsSourceKind =
  | "work"
  | "store"
  | "vendor"
  | "asset"
  | "visit"
  | "invoice"
  | "pm";

export interface OperationsSourceReference {
  kind: OperationsSourceKind;
  id: string;
}

export interface ExceptionQueueProps {
  dataset: DemoDataset;
  exceptions: ExceptionRecord[];
  onOpenSource: (source: OperationsSourceReference) => void;
  scopeLabel: string;
  className?: string;
}

export interface ActiveVisitWorkspaceProps {
  dataset: DemoDataset;
  visits: Visit[];
  onOpenWork: (workOrderId: string) => void;
  onOpenStore: (storeId: string) => void;
  onOpenVendor: (vendorId: string) => void;
  scopeLabel: string;
  initialVisitId?: string;
  className?: string;
}

type ExceptionGroup = "all" | "invoice" | "visit" | "pm" | "equipment" | "follow_up";
type ExceptionStatusFilter = "active" | ExceptionRecord["status"] | "all";
type VisitFilter = "active" | "unmatched" | "all";

interface ResolvedSource extends OperationsSourceReference {
  label: string;
  meta: string;
}

const exceptionGroups: Array<{ value: ExceptionGroup; label: string }> = [
  { value: "all", label: "All exceptions" },
  { value: "invoice", label: "Invoice safeguards" },
  { value: "visit", label: "Visit evidence" },
  { value: "pm", label: "Preventive maintenance" },
  { value: "equipment", label: "Equipment" },
  { value: "follow_up", label: "Follow-up" },
];

const exceptionStatusOptions: Array<{ value: ExceptionStatusFilter; label: string }> = [
  { value: "active", label: "Needs attention" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "Any status" },
];

const visitFilterOptions: Array<{ value: VisitFilter; label: string }> = [
  { value: "active", label: "Onsite now" },
  { value: "unmatched", label: "No work order" },
  { value: "all", label: "All supplied visits" },
];

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function words(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(minorUnits: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

function formatDuration(start: string, end: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.round((Date.parse(end) - Date.parse(start)) / 60_000),
  );
  if (!Number.isFinite(elapsedMinutes)) return "Unavailable";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function exceptionGroup(type: ExceptionType): Exclude<ExceptionGroup, "all"> {
  if (type.startsWith("invoice_") || type === "duplicate_invoice_reference") return "invoice";
  if (["visit_without_work_order", "missing_checkout", "outside_geofence"].includes(type)) return "visit";
  if (type === "pm_overdue") return "pm";
  if (["repeat_repair", "warranty_review", "classification_incomplete"].includes(type)) return "equipment";
  return "follow_up";
}

function exceptionGroupLabel(type: ExceptionType) {
  return exceptionGroups.find((option) => option.value === exceptionGroup(type))?.label ?? "Exception";
}

function channelLabel(channel: VisitChannel) {
  const labels: Record<VisitChannel, string> = {
    vendor_app: "Vendor app",
    qr_mobile_web: "Store QR link",
    secure_work_link: "Secure work-order link",
    store_kiosk: "Store device",
    manual_exception: "Manual exception",
  };
  return labels[channel];
}

function resolveExceptionSources(dataset: DemoDataset, exception: ExceptionRecord) {
  const sources: ResolvedSource[] = [];
  const seen = new Set<string>();

  function add(source: ResolvedSource | undefined) {
    if (!source) return;
    const key = `${source.kind}:${source.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    sources.push(source);
  }

  function resolve(id: string): ResolvedSource | undefined {
    const invoice = dataset.invoices.find((record) => record.id === id);
    if (invoice) {
      const total = invoice.lineItems.reduce((sum, line) => sum + line.amountMinor, 0);
      return {
        kind: "invoice",
        id,
        label: `Invoice ${invoice.invoiceNumber}`,
        meta: `${formatMoney(total)} · ${words(invoice.status)}`,
      };
    }

    const work = dataset.workOrders.find((record) => record.id === id);
    if (work) {
      return { kind: "work", id, label: work.number, meta: work.title };
    }

    const visit = dataset.visits.find((record) => record.id === id);
    if (visit) {
      return {
        kind: "visit",
        id,
        label: `Visit · ${visit.technicianName}`,
        meta: `${formatDateTime(visit.checkedInAt)} · ${visit.checkedOutAt ? "Checked out" : "Onsite now"}`,
      };
    }

    const asset = dataset.assets.find((record) => record.id === id);
    if (asset) {
      return { kind: "asset", id, label: asset.name, meta: `${asset.assetCode} · ${asset.locationDetail}` };
    }

    const vendor = dataset.vendors.find((record) => record.id === id);
    if (vendor) {
      return { kind: "vendor", id, label: vendor.displayName, meta: vendor.customerVendorNumber };
    }

    const store = dataset.stores.find((record) => record.id === id);
    if (store) {
      return { kind: "store", id, label: `Store ${store.storeNumber}`, meta: store.normalizedAddress };
    }

    const occurrence = dataset.pmOccurrences.find((record) => record.id === id);
    if (occurrence) {
      const plan = dataset.pmPlans.find((record) => record.id === occurrence.pmPlanId);
      return {
        kind: "pm",
        id,
        label: plan?.name ?? "PM occurrence",
        meta: `Due ${formatDateTime(occurrence.dueAt)} · ${words(occurrence.status)}`,
      };
    }

    const plan = dataset.pmPlans.find((record) => record.id === id);
    if (plan) {
      return {
        kind: "pm",
        id,
        label: plan.name,
        meta: `${words(plan.cadence)} plan · ${plan.requiredEvidence.map(words).join(", ")}`,
      };
    }

    return undefined;
  }

  // Put the most decision-relevant source first, then preserve every stored source reference.
  const orderedIds = exception.type === "pm_overdue"
    ? [exception.workOrderId, exception.visitId, ...exception.sourceRecordIds, exception.assetId, exception.vendorId, exception.storeId]
    : [exception.invoiceId, exception.workOrderId, exception.visitId, exception.assetId, exception.vendorId, exception.storeId, ...exception.sourceRecordIds];
  orderedIds.forEach((id) => {
    if (id) add(resolve(id));
  });

  return sources;
}

function SourceIcon({ kind }: { kind: OperationsSourceKind }) {
  if (kind === "invoice") return <FileText aria-hidden="true" />;
  if (kind === "work") return <Wrench aria-hidden="true" />;
  if (kind === "visit") return <MapPin aria-hidden="true" />;
  if (kind === "vendor") return <Truck aria-hidden="true" />;
  if (kind === "store") return <StoreIcon aria-hidden="true" />;
  if (kind === "pm") return <CalendarCheck aria-hidden="true" />;
  return <Building2 aria-hidden="true" />;
}

export function ExceptionQueue({
  dataset,
  exceptions,
  onOpenSource,
  scopeLabel,
  className,
}: ExceptionQueueProps) {
  const headingId = useId();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ExceptionGroup>("all");
  const [status, setStatus] = useState<ExceptionStatusFilter>("active");
  const [severity, setSeverity] = useState<"all" | "critical">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      exceptions
        .filter((exception) => group === "all" || exceptionGroup(exception.type) === group)
        .filter((exception) => severity === "all" || exception.severity === severity)
        .filter((exception) =>
          status === "all"
            ? true
            : status === "active"
              ? exception.status !== "resolved"
              : exception.status === status,
        )
        .filter((exception) => {
          if (!normalizedQuery) return true;
          const store = dataset.stores.find((record) => record.id === exception.storeId);
          const vendor = dataset.vendors.find((record) => record.id === exception.vendorId);
          const work = dataset.workOrders.find((record) => record.id === exception.workOrderId);
          const invoice = dataset.invoices.find((record) => record.id === exception.invoiceId);
          return [
            exception.title,
            exception.description,
            exception.type,
            store?.storeNumber,
            store?.name,
            store?.normalizedAddress,
            vendor?.displayName,
            work?.number,
            invoice?.invoiceNumber,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .sort((left, right) => {
          const severityOrder = { critical: 0, warning: 1, info: 2 };
          return severityOrder[left.severity] - severityOrder[right.severity] || left.dueAt.localeCompare(right.dueAt);
        }),
    [dataset.invoices, dataset.stores, dataset.vendors, dataset.workOrders, exceptions, group, normalizedQuery, severity, status],
  );

  const selected = filtered.find((exception) => exception.id === selectedId) ?? filtered[0] ?? null;
  const selectedSources = selected ? resolveExceptionSources(dataset, selected) : [];
  const selectedStore = selected?.storeId
    ? dataset.stores.find((record) => record.id === selected.storeId)
    : undefined;
  const selectedVendor = selected?.vendorId
    ? dataset.vendors.find((record) => record.id === selected.vendorId)
    : undefined;
  const selectedOwner = selected
    ? dataset.people.find((record) => record.id === selected.assignedPersonId)
    : undefined;
  const selectedInvoice = selectedSources
    .filter((source) => source.kind === "invoice")
    .map((source) => dataset.invoices.find((record) => record.id === source.id))
    .find(Boolean);
  const invoiceCount = new Set(
    exceptions
      .filter((exception) => exception.status !== "resolved" && exceptionGroup(exception.type) === "invoice")
      .flatMap((exception) => [exception.invoiceId, ...exception.sourceRecordIds])
      .filter((id): id is string => Boolean(id && dataset.invoices.some((invoice) => invoice.id === id))),
  ).size;
  const activeCount = exceptions.filter((exception) => exception.status !== "resolved").length;
  const criticalCount = exceptions.filter(
    (exception) => exception.status !== "resolved" && exception.severity === "critical",
  ).length;

  return (
    <section className={classes(styles.root, className)} aria-labelledby={headingId}>
      <header className={styles.workspaceHeader}>
        <div>
          <span className={styles.eyebrow}>Exact source records · {scopeLabel}</span>
          <h2 id={headingId}>Exceptions that need a decision</h2>
          <p>
            Review the fact, then open the work, visit, equipment, or invoice evidence behind it.
            An exception is not an accusation or payment decision.
          </p>
        </div>
        <span className={styles.demoBadge}>Demo Mode</span>
      </header>

      <div className={styles.summaryGrid} aria-label="Exception summary">
        <button
          type="button"
          className={classes(styles.summaryCard, status === "active" && group === "all" && styles.summaryCardActive)}
          onClick={() => {
            setStatus("active");
            setGroup("all");
            setSeverity("all");
            setQuery("");
          }}
        >
          <Clock3 aria-hidden="true" />
          <span><strong>{activeCount}</strong><small>Need attention</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={classes(styles.summaryCard, severity === "critical" && styles.summaryCardActive)}
          onClick={() => {
            setStatus("active");
            setGroup("all");
            setSeverity("critical");
            setQuery("");
          }}
        >
          <AlertTriangle aria-hidden="true" />
          <span><strong>{criticalCount}</strong><small>Critical signals</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={classes(styles.summaryCard, group === "invoice" && styles.summaryCardActive)}
          onClick={() => {
            setStatus("active");
            setGroup("invoice");
            setSeverity("all");
            setQuery("");
          }}
        >
          <ShieldCheck aria-hidden="true" />
          <span><strong>{invoiceCount}</strong><small>Invoice safeguards</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className={styles.controls}>
        <label className={classes(styles.field, styles.searchField)}>
          <span>Search exceptions</span>
          <span className={styles.inputWithIcon}>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Invoice, work order, vendor, store, or issue"
            />
          </span>
        </label>
        <label className={styles.field}>
          <span>Type</span>
          <select value={group} onChange={(event) => {
            setGroup(event.target.value as ExceptionGroup);
            setSeverity("all");
          }}>
            {exceptionGroups.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select value={status} onChange={(event) => {
            setStatus(event.target.value as ExceptionStatusFilter);
            setSeverity("all");
          }}>
            {exceptionStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <span className={styles.resultCount}>{filtered.length} {filtered.length === 1 ? "record" : "records"}</span>
      </div>

      <div className={styles.workspaceLayout}>
        <aside className={styles.recordRail} aria-label="Exception records">
          {filtered.length ? (
            <div className={styles.recordList}>
              {filtered.map((exception) => {
                const store = dataset.stores.find((record) => record.id === exception.storeId);
                const isSelected = selected?.id === exception.id;
                return (
                  <button
                    className={classes(styles.recordButton, isSelected && styles.recordButtonSelected)}
                    type="button"
                    key={exception.id}
                    onClick={() => setSelectedId(exception.id)}
                    aria-pressed={isSelected}
                  >
                    <span className={styles.severityDot} data-severity={exception.severity} />
                    <span className={styles.recordCopy}>
                      <span className={styles.recordMeta}>
                        {exceptionGroupLabel(exception.type)}
                        {store ? ` · Store ${store.storeNumber}` : " · Portfolio"}
                      </span>
                      <strong>{exception.title}</strong>
                      <small>Due {formatDateTime(exception.dueAt)}</small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyRail}>
              <CheckCircle2 aria-hidden="true" />
              <strong>No exceptions match</strong>
              <p>Change the search, type, or status filter.</p>
            </div>
          )}
        </aside>

        <div className={styles.detailPane}>
          {selected ? (
            <article className={styles.detailCard}>
              <header className={styles.detailHeader}>
                <div>
                  <span className={styles.detailKicker}>{exceptionGroupLabel(selected.type)} · {words(selected.type)}</span>
                  <h3>{selected.title}</h3>
                  <p>{selected.description}</p>
                </div>
                <span className={styles.statusBadge} data-severity={selected.severity}>{words(selected.severity)}</span>
              </header>

              <dl className={styles.factGrid}>
                <div><dt>Status</dt><dd>{words(selected.status)}</dd></div>
                <div><dt>Opened</dt><dd>{formatDateTime(selected.openedAt)}</dd></div>
                <div><dt>Review due</dt><dd>{formatDateTime(selected.dueAt)}</dd></div>
                <div><dt>Accountable reviewer</dt><dd>{selectedOwner?.displayName ?? "Assigned reviewer"}</dd></div>
                <div><dt>Store</dt><dd>{selectedStore ? `#${selectedStore.storeNumber} · ${selectedStore.address.city}` : "Portfolio-level"}</dd></div>
                <div><dt>Vendor</dt><dd>{selectedVendor?.displayName ?? "Not tied to one vendor"}</dd></div>
              </dl>

              {selectedInvoice ? (
                <section className={styles.contextCallout}>
                  <ShieldCheck aria-hidden="true" />
                  <span>
                    <strong>Optional invoice safeguard</strong>
                    <small>
                      Invoice {selectedInvoice.invoiceNumber} · {formatMoney(selectedInvoice.lineItems.reduce((sum, line) => sum + line.amountMinor, 0))}.
                      TraceOps shows the supporting difference for a person to review; it does not approve or pay the invoice.
                    </small>
                  </span>
                </section>
              ) : null}

              <section className={styles.sourceSection} aria-labelledby={`${headingId}-sources`}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span>Supporting records</span>
                    <h4 id={`${headingId}-sources`}>Open the exact source</h4>
                  </div>
                  <b>{selectedSources.length}</b>
                </div>
                {selectedSources.length ? (
                  <div className={styles.sourceList}>
                    {selectedSources.map((source) => (
                      <button
                        key={`${source.kind}-${source.id}`}
                        type="button"
                        className={styles.sourceButton}
                        onClick={() => onOpenSource({ kind: source.kind, id: source.id })}
                      >
                        <span className={styles.sourceIcon}><SourceIcon kind={source.kind} /></span>
                        <span><strong>{source.label}</strong><small>{source.meta}</small></span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noSources}>
                    <CircleAlert aria-hidden="true" />
                    <span><strong>No direct source link is stored</strong><small>The exception itself remains visible for audit and correction.</small></span>
                  </div>
                )}
              </section>
            </article>
          ) : (
            <div className={styles.emptyDetail}>
              <CheckCircle2 aria-hidden="true" />
              <strong>Nothing needs review in this view</strong>
              <p>The filters are preserved while you check another category.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ActiveVisitWorkspace({
  dataset,
  visits,
  onOpenWork,
  onOpenStore,
  onOpenVendor,
  scopeLabel,
  initialVisitId,
  className,
}: ActiveVisitWorkspaceProps) {
  const headingId = useId();
  const initialVisit = visits.find((visit) => visit.id === initialVisitId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VisitFilter>(initialVisit ? (!initialVisit.workOrderId ? "unmatched" : initialVisit.checkedOutAt ? "all" : "active") : "active");
  const [selectedId, setSelectedId] = useState<string | null>(initialVisitId ?? null);
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      visits
        .filter((visit) => {
          if (filter === "active") return !visit.checkedOutAt;
          if (filter === "unmatched") return !visit.workOrderId;
          return true;
        })
        .filter((visit) => {
          if (!normalizedQuery) return true;
          const store = dataset.stores.find((record) => record.id === visit.storeId);
          const vendor = dataset.vendors.find((record) => record.id === visit.vendorId);
          const work = dataset.workOrders.find((record) => record.id === visit.workOrderId);
          return [
            visit.technicianName,
            visit.technicianIdentifier,
            visit.purposeWhenUnmatched,
            store?.storeNumber,
            store?.name,
            store?.normalizedAddress,
            vendor?.displayName,
            work?.number,
            work?.title,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .sort((left, right) => {
          if (Boolean(left.checkedOutAt) !== Boolean(right.checkedOutAt)) return left.checkedOutAt ? 1 : -1;
          return right.checkedInAt.localeCompare(left.checkedInAt);
        }),
    [dataset.stores, dataset.vendors, dataset.workOrders, filter, normalizedQuery, visits],
  );

  const selected = filtered.find((visit) => visit.id === selectedId) ?? filtered[0] ?? null;
  const store = selected ? dataset.stores.find((record) => record.id === selected.storeId) : undefined;
  const vendor = selected?.vendorId ? dataset.vendors.find((record) => record.id === selected.vendorId) : undefined;
  const work = selected?.workOrderId ? dataset.workOrders.find((record) => record.id === selected.workOrderId) : undefined;
  const documents = selected
    ? dataset.documents.filter((document) => document.visitId === selected.id || selected.documentIds.includes(document.id))
    : [];
  const activeCount = visits.filter((visit) => !visit.checkedOutAt).length;
  const unmatchedCount = visits.filter((visit) => !visit.workOrderId).length;
  const activeStoreCount = new Set(visits.filter((visit) => !visit.checkedOutAt).map((visit) => visit.storeId)).size;
  const durationEnd = selected?.checkedOutAt ?? dataset.asOf;
  const observedDuration = selected ? formatDuration(selected.checkedInAt, durationEnd) : "—";

  return (
    <section className={classes(styles.root, className)} aria-labelledby={headingId}>
      <header className={styles.workspaceHeader}>
        <div>
          <span className={styles.eyebrow}>Observed visits · {scopeLabel}</span>
          <h2 id={headingId}>Who is onsite and what they came to do</h2>
          <p>
            One visit record follows the technician across QR, secure link, app, and store-device channels.
            Observed time is presence context, not certified labor.
          </p>
        </div>
        <span className={styles.demoBadge}>Demo Mode</span>
      </header>

      <div className={styles.summaryGrid} aria-label="Visit summary">
        <button
          type="button"
          className={classes(styles.summaryCard, filter === "active" && styles.summaryCardActive)}
          onClick={() => { setFilter("active"); setQuery(""); }}
        >
          <MapPin aria-hidden="true" />
          <span><strong>{activeCount}</strong><small>Onsite now</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.summaryCard}
          onClick={() => { setFilter("active"); setQuery(""); }}
        >
          <StoreIcon aria-hidden="true" />
          <span><strong>{activeStoreCount}</strong><small>Stores with activity</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={classes(styles.summaryCard, filter === "unmatched" && styles.summaryCardActive)}
          onClick={() => { setFilter("unmatched"); setQuery(""); }}
        >
          <CircleAlert aria-hidden="true" />
          <span><strong>{unmatchedCount}</strong><small>No work order</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className={styles.controls}>
        <label className={classes(styles.field, styles.searchField)}>
          <span>Search visits</span>
          <span className={styles.inputWithIcon}>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Technician, vendor, store, or work order"
            />
          </span>
        </label>
        <label className={styles.field}>
          <span>Visit view</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as VisitFilter)}>
            {visitFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <span className={styles.resultCount}>{filtered.length} {filtered.length === 1 ? "visit" : "visits"}</span>
      </div>

      <div className={styles.workspaceLayout}>
        <aside className={styles.recordRail} aria-label="Visit records">
          {filtered.length ? (
            <div className={styles.recordList}>
              {filtered.map((visit) => {
                const visitStore = dataset.stores.find((record) => record.id === visit.storeId);
                const visitVendor = dataset.vendors.find((record) => record.id === visit.vendorId);
                const isSelected = selected?.id === visit.id;
                return (
                  <button
                    className={classes(styles.recordButton, isSelected && styles.recordButtonSelected)}
                    type="button"
                    key={visit.id}
                    onClick={() => setSelectedId(visit.id)}
                    aria-pressed={isSelected}
                  >
                    <span className={classes(styles.avatar, !visit.checkedOutAt && styles.avatarActive)}>
                      {visit.technicianName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span className={styles.recordCopy}>
                      <span className={styles.recordMeta}>{visit.checkedOutAt ? "Checked out" : "Onsite now"} · Store {visitStore?.storeNumber ?? "—"}</span>
                      <strong>{visit.technicianName}</strong>
                      <small>{visitVendor?.displayName ?? "Internal maintenance"} · {formatDateTime(visit.checkedInAt)}</small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyRail}>
              <MapPin aria-hidden="true" />
              <strong>No visits match</strong>
              <p>Change the search or visit view.</p>
            </div>
          )}
        </aside>

        <div className={styles.detailPane}>
          {selected ? (
            <article className={styles.detailCard}>
              <header className={styles.visitHero}>
                <span className={classes(styles.largeAvatar, !selected.checkedOutAt && styles.largeAvatarActive)}>
                  <UserRound aria-hidden="true" />
                </span>
                <div>
                  <span className={styles.detailKicker}>{selected.checkedOutAt ? "Completed visit" : "Onsite now"}</span>
                  <h3>{selected.technicianName}</h3>
                  <p>{vendor?.displayName ?? "Internal maintenance"} · Store {store?.storeNumber ?? "—"}</p>
                </div>
                <span className={styles.statusBadge} data-severity={selected.checkedOutAt ? "info" : "warning"}>
                  {selected.checkedOutAt ? "Checked out" : "Active"}
                </span>
              </header>

              {!selected.workOrderId ? (
                <section className={classes(styles.contextCallout, styles.unmatchedCallout)}>
                  <CircleAlert aria-hidden="true" />
                  <span>
                    <strong>No customer work order was selected</strong>
                    <small>{selected.purposeWhenUnmatched ?? "The visit needs a manager to identify the service purpose and decide whether it belongs to existing or new work."}</small>
                  </span>
                </section>
              ) : null}

              <dl className={styles.factGrid}>
                <div><dt>Checked in</dt><dd>{formatDateTime(selected.checkedInAt)}</dd></div>
                <div><dt>Checked out</dt><dd>{selected.checkedOutAt ? formatDateTime(selected.checkedOutAt) : "Still onsite"}</dd></div>
                <div><dt>Observed duration</dt><dd>{observedDuration}<small>Approximate presence only</small></dd></div>
                <div><dt>Started through</dt><dd>{channelLabel(selected.channelStarted)}</dd></div>
                <div><dt>Ended through</dt><dd>{selected.channelEnded ? channelLabel(selected.channelEnded) : "Not checked out"}</dd></div>
                <div><dt>Outcome</dt><dd>{selected.outcome ? words(selected.outcome) : "Not recorded yet"}</dd></div>
              </dl>

              <section className={styles.evidencePanel}>
                <div className={styles.sectionHeading}>
                  <div><span>Check-in evidence</span><h4>{words(selected.evidenceStrength)}</h4></div>
                  {selected.locationEvidence.verification === "inside_geofence" ? <CheckCircle2 aria-hidden="true" /> : <MapPin aria-hidden="true" />}
                </div>
                <div className={styles.evidenceGrid}>
                  <div><span>Location result</span><strong>{words(selected.locationEvidence.verification)}</strong></div>
                  <div><span>Consent</span><strong>{selected.locationEvidence.consented ? "Shared for this event" : "Not shared"}</strong></div>
                  <div><span>Captured</span><strong>{formatDateTime(selected.locationEvidence.capturedAt)}</strong></div>
                  <div><span>Accuracy</span><strong>{selected.locationEvidence.accuracyMeters != null ? `±${Math.round(selected.locationEvidence.accuracyMeters)} m` : "Not available"}</strong></div>
                  <div><span>Distance from store</span><strong>{selected.locationEvidence.distanceFromStoreMeters != null ? `${Math.round(selected.locationEvidence.distanceFromStoreMeters)} m` : "Not available"}</strong></div>
                  <div><span>Files</span><strong>{documents.length}</strong></div>
                </div>
                {selected.locationEvidence.verification === "outside_geofence" ? (
                  <p className={styles.evidenceNote}>
                    <AlertTriangle aria-hidden="true" /> The captured point was outside the configured store radius. The visit remains recorded and visibly unverified.
                  </p>
                ) : null}
              </section>

              <section className={styles.sourceSection}>
                <div className={styles.sectionHeading}>
                  <div><span>Connected records</span><h4>Open the surrounding context</h4></div>
                </div>
                <div className={styles.sourceList}>
                  {work ? (
                    <button className={styles.sourceButton} type="button" onClick={() => onOpenWork(work.id)}>
                      <span className={styles.sourceIcon}><Wrench aria-hidden="true" /></span>
                      <span><strong>{work.number}</strong><small>{work.title}</small></span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  ) : null}
                  {store ? (
                    <button className={styles.sourceButton} type="button" onClick={() => onOpenStore(store.id)}>
                      <span className={styles.sourceIcon}><StoreIcon aria-hidden="true" /></span>
                      <span><strong>Store {store.storeNumber}</strong><small>{store.normalizedAddress}</small></span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  ) : null}
                  {vendor ? (
                    <button className={styles.sourceButton} type="button" onClick={() => onOpenVendor(vendor.id)}>
                      <span className={styles.sourceIcon}><Truck aria-hidden="true" /></span>
                      <span><strong>{vendor.displayName}</strong><small>{vendor.customerVendorNumber}</small></span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </section>
            </article>
          ) : (
            <div className={styles.emptyDetail}>
              <MapPin aria-hidden="true" />
              <strong>No visit selected</strong>
              <p>The current filter has no visit records.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
