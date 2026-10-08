import { count, money, shortDate, type ReportDoc, type Row, type Section } from "./doc";
import { completedIn, type JobFact, type ReportContext } from "./facts";
import type { ReportOptions } from "./options";
import type { ReportPeriod } from "./period";
import { scopeLabel } from "./common";

/** Differences under a dollar are rounding, not a review fact. */
const TOLERANCE = 100;

/** What AP should know about one vendor job: the plain-language check result. */
export function apCheck(job: Pick<JobFact, "nteMinor" | "completedAt">, recorded: number, invoiced: number) {
  if (!invoiced) return { text: job.completedAt ? "No invoice linked yet" : "Not finished; no invoice yet", flag: Boolean(job.completedAt) };
  if (job.nteMinor && invoiced > job.nteMinor + TOLERANCE) return { text: `Invoiced ${money(invoiced - job.nteMinor)} over the approved limit`, flag: true };
  if (invoiced - recorded > TOLERANCE) return { text: `Invoice ${money(invoiced - recorded)} more than recorded cost`, flag: true };
  if (recorded - invoiced > TOLERANCE) return { text: `Invoice ${money(recorded - invoiced)} less than recorded cost`, flag: true };
  return { text: "Invoice matches recorded cost", flag: false };
}

/**
 * Vendor work for AP: every outside-vendor work order with activity in the period, with the numbers AP
 * cross-references (our work order, the vendor's ticket, the invoice), and the ones worth a second look.
 * Outside vendors only. It does not approve or pay anything.
 */
export function buildVendorAp(ctx: ReportContext, options: ReportOptions, period: ReportPeriod): ReportDoc {
  const all = options.detail === "all";
  const invoiceById = new Map(ctx.fixture.invoices.filter(i => i.organizationId === ctx.organizationId).map(i => [i.id, i]));
  const active = (job: JobFact) => completedIn(job, period)
    || job.costs.some(c => c.provider === "vendor" && c.date >= period.from && c.date <= period.to)
    || job.invoices.some(i => i.date >= period.from && i.date <= period.to);
  const jobs = ctx.jobs.filter(job => job.vendorId && (!options.vendor || job.vendorId === options.vendor) && active(job));

  const lines = jobs.map(job => {
    const recorded = job.costs.filter(c => c.provider === "vendor").reduce((s, c) => s + c.amountMinor, 0);
    const invoiced = job.invoices.reduce((s, i) => s + i.amountMinor, 0);
    return { job, recorded, invoiced, check: apCheck(job, recorded, invoiced) };
  }).sort((a, b) => (a.job.vendorName ?? "").localeCompare(b.job.vendorName ?? "") || a.job.number.localeCompare(b.job.number));

  const unlinked = ctx.unlinkedInvoices.filter(u => u.date >= period.from && u.date <= period.to && (!options.vendor || u.vendorId === options.vendor));
  const flagged = lines.filter(l => l.check.flag);

  const row = (l: typeof lines[number]): Row => ({ id: l.job.id, href: `/app/work-orders/${l.job.id}`, tone: l.check.flag ? "warn" : undefined, group: l.job.vendorName,
    cells: { number: l.job.number, ticket: l.job.vendorTicket ?? "—", store: l.job.storeName, done: shortDate(l.job.completedAt), limit: l.job.nteMinor ? money(l.job.nteMinor) : "—",
      recorded: l.recorded ? money(l.recorded) : "—", invoice: l.job.invoices.map(i => i.number).join(", ") || "—", invoiced: l.invoiced ? money(l.invoiced) : "—", check: l.check.text },
    sub: { number: l.job.externalPo ? `PO ${l.job.externalPo}` : undefined, store: l.job.problem } });
  const columns = [{ key: "number", label: "Our work order" }, { key: "ticket", label: "Vendor ticket" }, { key: "store", label: "Store / problem", width: "wide" as const }, { key: "done", label: "Done" },
    { key: "limit", label: "Approved limit", align: "end" as const }, { key: "recorded", label: "Recorded cost", align: "end" as const }, { key: "invoice", label: "Invoice #" }, { key: "invoiced", label: "Invoiced", align: "end" as const }, { key: "check", label: "Check", width: "wide" as const }];

  const vendors = [...new Set(lines.map(l => l.job.vendorId!))];
  const sum = (rows: typeof lines, key: "recorded" | "invoiced") => rows.reduce((s, l) => s + l[key], 0);
  const sections: Section[] = [{
    kind: "table", id: "by-vendor", title: "By vendor",
    columns: [{ key: "vendor", label: "Vendor", width: "wide" }, { key: "jobs", label: "Work orders", align: "end" }, { key: "recorded", label: "Recorded cost", align: "end" }, { key: "invoiced", label: "Invoiced", align: "end" }, { key: "noInvoice", label: "Done, no invoice", align: "end" }, { key: "look", label: "Invoice differences", align: "end" }, { key: "unlinked", label: "Invoices not tied to a work order", align: "end" }],
    rows: vendors.map(id => { const rows = lines.filter(l => l.job.vendorId === id), loose = unlinked.filter(u => u.vendorId === id);
      return { id, href: `/app/vendors/${id}`, cells: { vendor: ctx.vendorName(id), jobs: count(rows.length), recorded: money(sum(rows, "recorded")), invoiced: money(sum(rows, "invoiced")),
        noInvoice: count(rows.filter(l => !l.invoiced && l.job.completedAt).length), look: count(rows.filter(l => l.check.flag && l.invoiced).length), unlinked: loose.length ? `${count(loose.length)} · ${money(loose.reduce((s, u) => s + u.amountMinor, 0))}` : "—" } }; }),
    totals: { vendor: "Total", jobs: count(lines.length), recorded: money(sum(lines, "recorded")), invoiced: money(sum(lines, "invoiced")) }, empty: "No vendor work in this period.",
  }];
  sections.push({ kind: "table", id: "look", title: "Worth a second look", note: "A difference is a fact to check, not proof something is wrong. Recorded cost is what was entered on the work order.", columns, rows: (all ? flagged : flagged.slice(0, 40)).map(row), empty: "Nothing stands out: every finished job has a linked invoice that matches.", more: !all && flagged.length > 40 ? `${flagged.length - 40} more in the full version` : undefined });
  if (unlinked.length) sections.push({ kind: "table", id: "unlinked", title: "Invoices not tied to a work order", note: "Received in this period but not yet linked to our work order number.",
    columns: [{ key: "vendor", label: "Vendor", width: "wide" }, { key: "number", label: "Invoice #" }, { key: "date", label: "Invoice date" }, { key: "amount", label: "Not tied", align: "end" }],
    rows: unlinked.map(u => ({ id: u.invoiceId, href: `/app/invoices/${u.invoiceId}`, cells: { vendor: ctx.vendorName(u.vendorId), number: invoiceById.get(u.invoiceId)?.vendorInvoiceNumber ?? "—", date: shortDate(u.date), amount: money(u.amountMinor) } })) });
  if (all) sections.push({ kind: "table", id: "records", title: "Every vendor work order in this period", detailOnly: true, columns, rows: lines.map(row),
    totals: { number: "Total", recorded: money(sum(lines, "recorded")), invoiced: money(sum(lines, "invoiced")) } });

  return {
    reportId: "vendor-ap", title: "Vendor work for accounts payable", audience: "vendor", organizationName: ctx.organizationName,
    scopeLabel: `${scopeLabel(ctx, options)}${options.vendor ? ` · ${ctx.vendorName(options.vendor)}` : ""}`, period, options,
    purpose: "Match vendor invoices to our work orders: our number, the vendor's ticket, what was recorded and what was invoiced.",
    howCounted: [
      "Includes every outside-vendor work order finished in the period, or with vendor cost or an invoice dated in the period.",
      "Recorded cost is the vendor cost entered on the work order. Invoiced is the part of each invoice linked to that work order.",
      "Approved limit is the not-to-exceed amount set when the work was sent, if one was set.",
      "Differences under $1 are treated as rounding.",
    ],
    highlights: [
      `${count(lines.length)} vendor work orders, ${money(sum(lines, "invoiced"))} invoiced against ${money(sum(lines, "recorded"))} recorded.`,
      ...(flagged.length ? [`${count(flagged.length)} ${flagged.length === 1 ? "work order needs" : "work orders need"} a second look (no invoice yet, or a difference).`] : ["Every finished job has a matching invoice."]),
      ...(unlinked.length ? [`${count(unlinked.length)} ${unlinked.length === 1 ? "invoice isn't" : "invoices aren't"} tied to a work order yet (${money(unlinked.reduce((s, u) => s + u.amountMinor, 0))}).`] : []),
    ],
    kpis: [
      { label: "Vendor work orders", value: count(lines.length) },
      { label: "Recorded vendor cost", value: money(sum(lines, "recorded")) },
      { label: "Invoiced", value: money(sum(lines, "invoiced")) },
      { label: "Needs a look", value: count(flagged.length), note: "No invoice yet, or a difference" },
    ],
    sections, recordsSectionId: all ? "records" : "look",
    notes: ["This report helps cross-reference invoices. It does not approve or pay anything."],
  };
}
