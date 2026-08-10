"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  FileSearch2,
  FileText,
  Link2,
  ReceiptText,
  Search,
  ShieldCheck,
  Store as StoreIcon,
  Timer,
  Truck,
  Wrench,
} from "lucide-react";

import type {
  DemoDataset,
  ExceptionRecord,
  Invoice,
  InvoiceWorkLink,
  Store,
  WorkOrder,
} from "../../lib/cstore/types";
import styles from "./maintenance-cost-review.module.css";

export type InvoiceEvidenceFilter = "needs_review" | "no_open_flags" | "all";

export interface InvoiceEvidenceQueueValue {
  filter: InvoiceEvidenceFilter;
  query: string;
}

export interface InvoiceEvidenceQueueProps {
  dataset: DemoDataset;
  scopeLabel: string;
  scope?: {
    regionId?: string;
    storeId?: string;
    categoryId?: string;
    vendorId?: string;
  };
  onOpenInvoice: (invoiceId: string) => void;
  onOpenWork: (workOrderId: string) => void;
  initialFilter?: InvoiceEvidenceFilter;
  value?: InvoiceEvidenceQueueValue;
  onChange?: (value: InvoiceEvidenceQueueValue) => void;
}

export interface InvoiceEvidenceDetailProps {
  dataset: DemoDataset;
  invoice: Invoice;
  onOpenWork: (workOrderId: string) => void;
  onOpenStore: (storeId: string) => void;
  onOpenVendor: (vendorId: string) => void;
  onResolveReview: (invoiceId: string) => void;
  canResolve: boolean;
}

interface ReviewReason {
  id: string;
  title: string;
  description: string;
  severity: ExceptionRecord["severity"];
  resolved: boolean;
}

interface InvoiceContext {
  invoice: Invoice;
  vendorName: string;
  links: InvoiceWorkLink[];
  workOrders: WorkOrder[];
  stores: Store[];
  totalMinor: number;
  linkedMinor: number;
  reasons: ReviewReason[];
  openReasons: ReviewReason[];
  needsReview: boolean;
  reviewed: boolean;
}

const filterOptions: Array<{ value: InvoiceEvidenceFilter; label: string }> = [
  { value: "needs_review", label: "Needs attention" },
  { value: "no_open_flags", label: "Reviewed / no active review" },
  { value: "all", label: "All invoices" },
];

function classes(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

function money(amountMinor: number, currency: Invoice["currency"] = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function words(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function durationLabel(checkedInAt: string, checkedOutAt?: string) {
  if (!checkedOutAt) return "Active visit";
  const durationMinutes = Math.max(
    0,
    Math.round((Date.parse(checkedOutAt) - Date.parse(checkedInAt)) / 60_000),
  );
  if (!Number.isFinite(durationMinutes)) return "Duration unavailable";
  if (durationMinutes < 60) return `${durationMinutes} min observed`;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${hours} hr${minutes ? ` ${minutes} min` : ""} observed`;
}

function reviewStatusLabel(context: InvoiceContext) {
  if (context.reviewed) return "Evidence reviewed · facts preserved";
  if (context.needsReview) return "Needs attention";
  if (context.invoice.status === "archived") return "Archived record";
  if (context.invoice.status === "approved") return "Evidence reviewed";
  return "No open flags";
}

function buildInvoiceContext(dataset: DemoDataset, invoice: Invoice): InvoiceContext {
  const links = dataset.invoiceWorkLinks.filter((link) => link.invoiceId === invoice.id);
  const workOrderIds = new Set(links.map((link) => link.workOrderId));
  const workOrders = dataset.workOrders.filter((work) => workOrderIds.has(work.id));
  const storeIds = new Set(links.map((link) => link.storeId));
  const stores = dataset.stores.filter((store) => storeIds.has(store.id));
  const exceptions = dataset.exceptions.filter(
    (exception) =>
      exception.invoiceId === invoice.id || exception.sourceRecordIds.includes(invoice.id),
  );
  const reasons: ReviewReason[] = exceptions.map((exception) => ({
    id: exception.id,
    title: exception.title,
    description: exception.description,
    severity: exception.severity,
    resolved: exception.status === "resolved",
  }));

  if (
    links.some((link) => link.matchStatus === "review_needed") &&
    !reasons.some((reason) => /match|work-order|work order|reference/i.test(`${reason.title} ${reason.description}`))
  ) {
    reasons.push({
      id: `${invoice.id}-match-review`,
      title: "Work-order match needs confirmation",
      description:
        "TraceOps found related maintenance records, but a person still needs to confirm the invoice-to-work link.",
      severity: "warning",
      resolved: false,
    });
  }

  if (
    invoice.customerWorkOrderReferences.length === 0 &&
    !reasons.some((reason) => /missing|omit|reference/i.test(`${reason.title} ${reason.description}`))
  ) {
    reasons.push({
      id: `${invoice.id}-missing-reference`,
      title: "Customer work-order number is missing",
      description:
        "Vendor, store, dates, and service details may suggest a match, but the connection requires human confirmation.",
      severity: "warning",
      resolved: false,
    });
  }

  if (invoice.status === "needs_review" && !reasons.some((reason) => !reason.resolved)) {
    reasons.push({
      id: `${invoice.id}-review-state`,
      title: "Maintenance evidence review is still open",
      description:
        "Review the linked work, visits, authorization, and files before handing this record to the accounting process.",
      severity: "info",
      resolved: false,
    });
  }

  const openReasons = reasons.filter((reason) => !reason.resolved);
  const reviewed = dataset.auditEvents.some(
    (event) =>
      event.entityType === "invoice" &&
      event.entityId === invoice.id &&
      event.eventType === "maintenance_invoice_evidence_reviewed",
  );
  return {
    invoice,
    vendorName:
      dataset.vendors.find((vendor) => vendor.id === invoice.vendorId)?.displayName ??
      "Vendor record unavailable",
    links,
    workOrders,
    stores,
    totalMinor: invoice.lineItems.reduce((sum, line) => sum + line.amountMinor, 0),
    linkedMinor: links.reduce((sum, link) => sum + link.attributedAmountMinor, 0),
    reasons,
    openReasons,
    reviewed,
    needsReview: !reviewed && (
      invoice.status === "needs_review" ||
      links.some((link) => link.matchStatus === "review_needed") ||
      openReasons.length > 0
    ),
  };
}

export function InvoiceEvidenceQueue({
  dataset,
  scopeLabel,
  scope,
  onOpenInvoice,
  onOpenWork,
  initialFilter = "needs_review",
  value,
  onChange,
}: InvoiceEvidenceQueueProps) {
  const [localFilter, setLocalFilter] = useState<InvoiceEvidenceFilter>(initialFilter);
  const [localQuery, setLocalQuery] = useState("");
  const filter = value?.filter ?? localFilter;
  const query = value?.query ?? localQuery;

  function setFilter(nextFilter: InvoiceEvidenceFilter) {
    if (!value) setLocalFilter(nextFilter);
    onChange?.({ filter: nextFilter, query });
  }

  function setQuery(nextQuery: string) {
    if (!value) setLocalQuery(nextQuery);
    onChange?.({ filter, query: nextQuery });
  }

  const contexts = useMemo(
    () =>
      dataset.invoices
        .map((invoice) => buildInvoiceContext(dataset, invoice))
        .sort((left, right) => right.invoice.receivedAt.localeCompare(left.invoice.receivedAt)),
    [dataset],
  );

  const scopedContexts = contexts.filter((context) => {
    if (scope?.regionId && scope.regionId !== "all" && !context.stores.some((store) => store.regionId === scope.regionId)) return false;
    if (scope?.storeId && scope.storeId !== "all" && !context.stores.some((store) => store.id === scope.storeId)) return false;
    if (scope?.categoryId && scope.categoryId !== "all" && !context.workOrders.some((work) => work.categoryId === scope.categoryId)) return false;
    if (scope?.vendorId && scope.vendorId !== "all" && context.invoice.vendorId !== scope.vendorId) return false;
    return true;
  });

  const normalizedQuery = query.trim().toLowerCase();
  const rows = scopedContexts.filter((context) => {
    if (filter === "needs_review" && !context.needsReview) return false;
    if (filter === "no_open_flags" && context.needsReview) return false;
    if (!normalizedQuery) return true;

    const searchText = [
      context.invoice.invoiceNumber,
      context.vendorName,
      ...context.invoice.customerWorkOrderReferences,
      ...context.invoice.vendorServiceReferences,
      ...context.stores.flatMap((store) => [
        store.storeNumber,
        store.name,
        store.normalizedAddress,
      ]),
      ...context.workOrders.flatMap((work) => [work.number, work.title, work.problemDescription]),
      ...context.reasons.flatMap((reason) => [reason.title, reason.description]),
    ]
      .join(" ")
      .toLowerCase();

    return searchText.includes(normalizedQuery);
  });

  const needsAttention = scopedContexts.filter((context) => context.needsReview).length;
  const exactReferences = scopedContexts.filter(
    (context) =>
      context.links.length > 0 &&
      context.links.every(
        (link) =>
          link.matchMethod === "work_order_reference" && link.matchStatus === "matched",
      ),
  ).length;
  const linkedMinor = scopedContexts.reduce((sum, context) => sum + context.linkedMinor, 0);

  return (
    <section className={styles.root} aria-labelledby="invoice-evidence-title">
      <header className={styles.queueHeader}>
        <div>
          <span className={styles.eyebrow}>Optional maintenance safeguard · {scopeLabel}</span>
          <h1 id="invoice-evidence-title">Invoice evidence review</h1>
          <p>
            Compare a vendor invoice with the customer work order, authorization, visits,
            and files behind it.
          </p>
        </div>
        <span className={styles.demoBadge}>Demo Mode</span>
      </header>

      <div className={styles.boundaryCallout} role="note">
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>Maintenance evidence, not accounts payable</strong>
          <small>
            TraceOps identifies facts and preserves the source trail. It does not approve,
            reject, schedule, or pay an invoice.
          </small>
        </span>
      </div>

      <section className={styles.summaryGrid} aria-label="Invoice evidence summary">
        <article className={styles.summaryCard} data-tone="attention">
          <span><AlertTriangle aria-hidden="true" /> Needs attention</span>
          <strong>{needsAttention}</strong>
          <small>Invoices with an open maintenance-evidence fact</small>
        </article>
        <article className={styles.summaryCard} data-tone="matched">
          <span><Link2 aria-hidden="true" /> Exact WO reference</span>
          <strong>{exactReferences}</strong>
          <small>Matched by the operator work-order number</small>
        </article>
        <article className={styles.summaryCard} data-tone="cost">
          <span><CircleDollarSign aria-hidden="true" /> Linked invoice amount</span>
          <strong>{money(linkedMinor)}</strong>
          <small>Explicitly attributed to maintenance source records</small>
        </article>
      </section>

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Search invoice evidence</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search invoice, vendor, store, WO, or review reason…"
          />
        </label>
        <div className={styles.filterTabs} aria-label="Invoice evidence filter">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span>
                {option.value === "all"
                  ? scopedContexts.length
                  : option.value === "needs_review"
                    ? needsAttention
                    : scopedContexts.length - needsAttention}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.resultsHeader}>
        <span>
          <strong>{rows.length}</strong> {rows.length === 1 ? "invoice" : "invoices"}
        </span>
        <small>Newest received first</small>
      </div>

      {rows.length ? (
        <div className={styles.invoiceList}>
          {rows.map((context) => {
            const primaryLink = context.links[0];
            const primaryWork = primaryLink
              ? dataset.workOrders.find((work) => work.id === primaryLink.workOrderId)
              : undefined;
            const storeLabel = context.stores.length
              ? context.stores.map((store) => `Store ${store.storeNumber}`).join(", ")
              : "Store not linked";
            const workReferences = context.invoice.customerWorkOrderReferences.length
              ? context.invoice.customerWorkOrderReferences.join(", ")
              : "Missing from invoice";

            return (
              <article className={styles.invoiceRow} key={context.invoice.id}>
                <button
                  className={styles.invoiceOpen}
                  type="button"
                  onClick={() => onOpenInvoice(context.invoice.id)}
                  aria-label={`Open invoice ${context.invoice.invoiceNumber}`}
                >
                  <span
                    className={classes(
                      styles.invoiceIcon,
                      context.needsReview ? styles.invoiceIconAttention : styles.invoiceIconClear,
                    )}
                  >
                    {context.needsReview ? <AlertTriangle /> : <FileCheck2 />}
                  </span>
                  <span className={styles.invoiceIdentity}>
                    <span className={styles.invoiceTopline}>
                      <strong>{context.invoice.invoiceNumber}</strong>
                      <span
                        className={classes(
                          styles.statusBadge,
                          context.needsReview ? styles.statusAttention : styles.statusClear,
                        )}
                      >
                        {reviewStatusLabel(context)}
                      </span>
                    </span>
                    <span>{context.vendorName}</span>
                    <small>Received {dateLabel(context.invoice.receivedAt)}</small>
                  </span>
                  <span className={styles.invoiceReference}>
                    <small>Customer WO reference</small>
                    <strong data-missing={!context.invoice.customerWorkOrderReferences.length}>
                      {workReferences}
                    </strong>
                    <span>{storeLabel}</span>
                  </span>
                  <span className={styles.invoiceAmount}>
                    <small>Invoice amount</small>
                    <strong>{money(context.totalMinor, context.invoice.currency)}</strong>
                    <span>{money(context.linkedMinor, context.invoice.currency)} linked</span>
                  </span>
                  <ChevronRight className={styles.chevron} aria-hidden="true" />
                </button>

                <footer className={styles.reasonStrip}>
                  <div>
                    {context.openReasons.length ? (
                      context.openReasons.slice(0, 2).map((reason) => (
                        <span className={styles.reasonTag} data-severity={reason.severity} key={reason.id}>
                          {reason.title}
                        </span>
                      ))
                    ) : (
                      <span className={styles.clearReason}>
                        <CheckCircle2 aria-hidden="true" /> No open maintenance-evidence flags
                      </span>
                    )}
                    {context.openReasons.length > 2 ? (
                      <span className={styles.moreReasons}>+{context.openReasons.length - 2} more</span>
                    ) : null}
                  </div>
                  {primaryWork ? (
                    <button type="button" onClick={() => onOpenWork(primaryWork.id)}>
                      Open {primaryWork.number} <ArrowRight aria-hidden="true" />
                    </button>
                  ) : (
                    <span className={styles.unlinkedLabel}>No confirmed work-order link</span>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <FileSearch2 aria-hidden="true" />
          <strong>No invoices match this view</strong>
          <p>Try another filter or search term. No records have been hidden from the totals.</p>
        </div>
      )}
    </section>
  );
}

export function InvoiceEvidenceDetail({
  dataset,
  invoice,
  onOpenWork,
  onOpenStore,
  onOpenVendor,
  onResolveReview,
  canResolve,
}: InvoiceEvidenceDetailProps) {
  const context = useMemo(() => buildInvoiceContext(dataset, invoice), [dataset, invoice]);
  const vendor = dataset.vendors.find((record) => record.id === invoice.vendorId);
  const workIds = new Set(context.workOrders.map((work) => work.id));
  const visits = dataset.visits.filter(
    (visit) => visit.workOrderId && workIds.has(visit.workOrderId),
  );
  const visitIds = new Set(visits.map((visit) => visit.id));
  const documents = dataset.documents
    .filter(
      (document) =>
        document.invoiceId === invoice.id ||
        (document.workOrderId && workIds.has(document.workOrderId)) ||
        (document.visitId && visitIds.has(document.visitId)),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const differenceMinor = context.totalMinor - context.linkedMinor;

  return (
    <section className={styles.root} aria-labelledby="invoice-detail-title">
      <header className={styles.detailHeader}>
        <div className={styles.detailIdentity}>
          <span className={styles.invoiceIcon} data-attention={context.needsReview}>
            {context.needsReview ? <AlertTriangle /> : <ReceiptText />}
          </span>
          <div>
            <span className={styles.eyebrow}>Maintenance invoice evidence</span>
            <h1 id="invoice-detail-title">{invoice.invoiceNumber}</h1>
            <p>{context.vendorName} · received {dateLabel(invoice.receivedAt)}</p>
          </div>
        </div>
        <div className={styles.detailHeaderActions}>
          <span
            className={classes(
              styles.statusBadge,
              context.needsReview ? styles.statusAttention : styles.statusClear,
            )}
          >
            {reviewStatusLabel(context)}
          </span>
          {vendor ? (
            <button className={styles.secondaryButton} type="button" onClick={() => onOpenVendor(vendor.id)}>
              <Truck aria-hidden="true" /> Vendor record
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.boundaryCallout} role="note">
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>This review does not approve payment</strong>
          <small>
            It assembles maintenance facts for a human reviewer. The customer’s accounting
            system remains authoritative.
          </small>
        </span>
      </div>

      <section className={styles.detailSummary} aria-label="Invoice linkage summary">
        <article>
          <span>Invoice amount</span>
          <strong>{money(context.totalMinor, invoice.currency)}</strong>
          <small>{invoice.lineItems.length} source {invoice.lineItems.length === 1 ? "line" : "lines"}</small>
        </article>
        <article>
          <span>Linked to maintenance</span>
          <strong>{money(context.linkedMinor, invoice.currency)}</strong>
          <small>{context.links.length} explicit {context.links.length === 1 ? "attribution" : "attributions"}</small>
        </article>
        <article data-tone={differenceMinor === 0 ? "clear" : "attention"}>
          <span>Not yet linked</span>
          <strong>{money(Math.max(0, differenceMinor), invoice.currency)}</strong>
          <small>{differenceMinor === 0 ? "Invoice total is fully attributed" : "Requires human review"}</small>
        </article>
        <article>
          <span>Observed visits</span>
          <strong>{visits.length}</strong>
          <small>Presence context only · not certified labor</small>
        </article>
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.panelIcon}><ReceiptText aria-hidden="true" /></span>
              <span><strong>Invoice source record</strong><small>Vendor-provided identifiers stay separate</small></span>
            </div>
          </header>
          <dl className={styles.definitionList}>
            <div><dt>Vendor invoice</dt><dd>{invoice.invoiceNumber}</dd></div>
            <div><dt>Invoice date</dt><dd>{dateLabel(invoice.invoiceDate)}</dd></div>
            <div><dt>Customer WO reference</dt><dd data-missing={!invoice.customerWorkOrderReferences.length}>{invoice.customerWorkOrderReferences.join(", ") || "Missing from invoice"}</dd></div>
            <div><dt>Vendor service ticket</dt><dd>{invoice.vendorServiceReferences.join(", ") || "Not provided"}</dd></div>
            <div><dt>Source file</dt><dd>{dataset.documents.find((document) => document.id === invoice.documentId)?.fileName ?? "File record unavailable"}</dd></div>
          </dl>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.panelIcon}><AlertTriangle aria-hidden="true" /></span>
              <span><strong>Facts requiring attention</strong><small>Neutral signals, never automatic accusations</small></span>
            </div>
            <span className={styles.countBadge}>{context.openReasons.length} open</span>
          </header>
          <div className={styles.reviewReasons}>
            {context.reasons.length ? (
              context.reasons.map((reason) => (
                <article
                  key={reason.id}
                  className={styles.reasonCard}
                  data-severity={reason.severity}
                  data-resolved={reason.resolved}
                >
                  <span>{reason.resolved ? <CheckCircle2 /> : <AlertTriangle />}</span>
                  <div>
                    <strong>{reason.title}</strong>
                    <p>{reason.description}</p>
                  </div>
                  <small>{reason.resolved ? "Resolved" : words(reason.severity)}</small>
                </article>
              ))
            ) : (
              <div className={styles.compactEmpty}>
                <CheckCircle2 aria-hidden="true" />
                <span><strong>No open review facts</strong><small>The current links reconcile to the invoice total.</small></span>
              </div>
            )}
          </div>
        </article>
      </section>

      <article className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <span className={styles.panelIcon}><Wrench aria-hidden="true" /></span>
            <span><strong>Linked maintenance work</strong><small>Open the exact source behind each attributed amount</small></span>
          </div>
          <span className={styles.countBadge}>{context.links.length} linked</span>
        </header>
        {context.links.length ? (
          <div className={styles.workList}>
            {context.links.map((link) => {
              const work = dataset.workOrders.find((record) => record.id === link.workOrderId);
              const store = dataset.stores.find((record) => record.id === link.storeId);
              const workVisits = dataset.visits.filter((visit) => visit.workOrderId === link.workOrderId);
              const category = work?.categoryId
                ? dataset.categories.find((record) => record.id === work.categoryId)
                : undefined;
              if (!work) return null;
              const nteDifference = work.notToExceedMinor === undefined
                ? undefined
                : link.attributedAmountMinor - work.notToExceedMinor;

              return (
                <article className={styles.workCard} key={link.id}>
                  <header>
                    <div>
                      <span className={styles.workNumber}>{work.number}</span>
                      <h2>{work.title}</h2>
                      <p>{store ? `Store ${store.storeNumber} · ${store.address.city}` : "Store unavailable"}{category ? ` · ${category.label}` : " · Unclassified"}</p>
                    </div>
                    <span className={styles.matchBadge} data-review={link.matchStatus === "review_needed"}>
                      {link.matchStatus === "review_needed" ? "Match needs review" : `Matched by ${words(link.matchMethod).toLowerCase()}`}
                    </span>
                  </header>
                  <div className={styles.workFacts}>
                    <div><span>Attributed invoice amount</span><strong>{money(link.attributedAmountMinor, link.currency)}</strong></div>
                    <div><span>Issued NTE</span><strong>{work.notToExceedMinor === undefined ? "Not used" : money(work.notToExceedMinor, work.currency)}</strong></div>
                    <div data-tone={nteDifference !== undefined && nteDifference > 0 ? "attention" : undefined}><span>Invoice vs. NTE</span><strong>{nteDifference === undefined ? "Not compared" : nteDifference === 0 ? "$0 difference" : `${nteDifference > 0 ? "+" : "−"}${money(Math.abs(nteDifference), work.currency)}`}</strong></div>
                    <div><span>Operational outcome</span><strong>{work.outcome ? words(work.outcome) : words(work.status)}</strong></div>
                  </div>
                  <div className={styles.visitEvidence}>
                    <span><Timer aria-hidden="true" /></span>
                    <div>
                      <strong>{workVisits.length} observed {workVisits.length === 1 ? "visit" : "visits"}</strong>
                      <p>{workVisits.length ? workVisits.map((visit) => `${visit.technicianName} · ${durationLabel(visit.checkedInAt, visit.checkedOutAt)}`).join(" · ") : "No visit evidence is linked to this work order."}</p>
                    </div>
                    <small>Approximate presence, not billable labor</small>
                  </div>
                  <footer>
                    <button className={styles.primaryButton} type="button" onClick={() => onOpenWork(work.id)}>
                      Open work order <ArrowRight aria-hidden="true" />
                    </button>
                    {store ? (
                      <button className={styles.secondaryButton} type="button" onClick={() => onOpenStore(store.id)}>
                        <StoreIcon aria-hidden="true" /> Store dashboard
                      </button>
                    ) : null}
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Link2 aria-hidden="true" />
            <strong>No confirmed maintenance link</strong>
            <p>This invoice remains visible until a person confirms the supporting work.</p>
          </div>
        )}
      </article>

      <section className={styles.detailGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.panelIcon}><FileText aria-hidden="true" /></span>
              <span><strong>Invoice lines</strong><small>Vendor-provided descriptions and amounts</small></span>
            </div>
          </header>
          <div className={styles.lineItems}>
            {invoice.lineItems.map((line) => (
              <div key={line.id}>
                <span><strong>{line.description}</strong><small>{words(line.costType)} · {line.quantity} × {money(line.unitAmountMinor, invoice.currency)}</small></span>
                <strong>{money(line.amountMinor, invoice.currency)}</strong>
              </div>
            ))}
            <footer><span>Invoice total</span><strong>{money(context.totalMinor, invoice.currency)}</strong></footer>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.panelIcon}><FileSearch2 aria-hidden="true" /></span>
              <span><strong>Supporting files</strong><small>Invoice, service, visit, and work evidence</small></span>
            </div>
            <span className={styles.countBadge}>{documents.length}</span>
          </header>
          <div className={styles.documentList}>
            {documents.length ? documents.map((document) => (
              <div key={document.id}>
                <span className={styles.documentIcon}><FileText aria-hidden="true" /></span>
                <span><strong>{document.fileName}</strong><small>{words(document.kind)} · {dateLabel(document.createdAt)} · {document.createdByLabel}</small></span>
                <span className={styles.documentScope}>{document.visibility === "operator_only" ? "Internal" : "Shared"}</span>
              </div>
            )) : (
              <div className={styles.compactEmpty}>
                <FileSearch2 aria-hidden="true" />
                <span><strong>No supporting files</strong><small>The invoice record remains visible with this gap.</small></span>
              </div>
            )}
          </div>
        </article>
      </section>

      <footer className={styles.reviewFooter}>
        <div>
          <span className={styles.reviewFooterIcon}><Building2 aria-hidden="true" /></span>
          <span>
            <strong>Finish the maintenance evidence review</strong>
            <small>
              Resolving these flags records that the maintenance trail was reviewed. It does
              not approve or pay the vendor invoice.
            </small>
          </span>
        </div>
        {context.needsReview ? (
          canResolve ? (
            <button className={styles.primaryButton} type="button" onClick={() => onResolveReview(invoice.id)}>
              <FileCheck2 aria-hidden="true" /> Mark evidence reviewed
            </button>
          ) : (
            <span className={styles.readOnlyNote}><ShieldCheck aria-hidden="true" /> Read-only review access</span>
          )
        ) : (
          <span className={styles.completeNote}><CheckCircle2 aria-hidden="true" /> Evidence review complete</span>
        )}
      </footer>
    </section>
  );
}
