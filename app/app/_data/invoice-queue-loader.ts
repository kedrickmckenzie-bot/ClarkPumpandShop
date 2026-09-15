import "server-only";
import { notFound } from "next/navigation";
import { roleCanAccessListRoute } from "@/components/ops/role-policy";
import { invoiceQueueViews, type InvoiceQueueView } from "@/lib/ops/invoice-queue-query";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "./operator-loader";

export async function loadInvoiceQueue(params: Record<string, string | string[] | undefined> = {}) {
  const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  const session = await loadOperatorSession();
  if (!roleCanAccessListRoute(session.role, "invoices")) notFound();
  const rawView = first(params.view), view: InvoiceQueueView = invoiceQueueViews.includes(rawView as InvoiceQueueView) ? rawView as InvoiceQueueView : "all";
  const requested = Number(first(params.page) ?? 1), page = Number.isSafeInteger(requested) && requested > 0 && requested <= 1_000_000 ? requested : 1;
  const rawCurrency = first(params.currency)?.toUpperCase(), currency = /^[A-Z]{3}$/.test(rawCurrency ?? "") ? rawCurrency! : "USD", search = first(params.q)?.trim().slice(0, 160) ?? "";
  const result = await (await getServerOpsRepository()).listInvoiceQueue(session, { view, search, currency, limit: 25, offset: (page - 1) * 25 });
  const companywide = session.storeIds === undefined && session.regionIds === undefined;
  const writable = session.accessMode === "preview" || Boolean(session.permissions?.length) && (session.permissions ?? []).every(p => ["ops:*", "ops:write", "ops:read_write", "ops:store_manage"].includes(p));
  const financeRole = ["executive", "facilities", "finance"].includes(session.role);
  return { result, view, page, currency, search, scopeLabel: session.scopeLabel, canReceive: companywide && financeRole && writable, canReadAccounting: companywide && financeRole };
}
