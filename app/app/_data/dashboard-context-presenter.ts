import type { DashboardPageViewModel } from "@/components/ops/data-contract";
import type { DashboardContext } from "@/lib/ops/dashboard-context";
import { priceLabel } from "@/lib/ops/lifecycle-price-evidence";
import { domainLabel } from "@/lib/product/domain-label";

export function presentInvoiceSpotlight(invoice: DashboardContext["invoice"]): DashboardPageViewModel["spotlight"] {
  return invoice ? {
    eyebrow: "Invoice review", title: `Review invoice ${invoice.number}`,
    description: "Check the flagged charges and supporting work.",
    facts: [
      { label: `Invoice total · ${invoice.total.currency}`, value: priceLabel(invoice.total) },
      { label: "Status", value: invoice.status === "exception" ? "Needs review" : domainLabel(invoice.status) },
      { label: "Vendor", value: invoice.vendorName },
    ],
    link: { href: `/app/invoices/${invoice.id}`, label: "Review invoice" },
  } : undefined;
}
