import "server-only";
import { notFound } from "next/navigation";
import { roleCanAccessDetailRoute } from "@/components/ops/role-policy";
import { invoiceRecordSections, type InvoiceRecordSection } from "@/lib/ops/invoice-record-query";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "./operator-loader";

export async function loadInvoiceRecord(id: string, params: Record<string, string | string[] | undefined> = {}) {
  const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  const session = await loadOperatorSession();
  if (!roleCanAccessDetailRoute(session.role, "invoice")) notFound();
  const rawSection = first(params.section), section: InvoiceRecordSection = invoiceRecordSections.includes(rawSection as InvoiceRecordSection) ? rawSection as InvoiceRecordSection : "items";
  const requested = Number(first(params.page) ?? 1), page = Number.isSafeInteger(requested) && requested > 0 && requested <= 1_000_000 ? requested : 1;
  const unrestricted = session.storeIds === undefined && session.regionIds === undefined;
  const accounting = unrestricted && ["executive", "facilities", "finance"].includes(session.role);
  const rawBasis = first(params.basis);
  const basis: "linked" | "unmatched" | undefined = rawBasis === "linked" && section === "matches" || rawBasis === "unmatched" && section === "items" ? rawBasis : undefined;
  const open = section === "flags" && first(params.open) === "yes";
  const result = await (await getServerOpsRepository()).readInvoiceRecord(session, id, { section, line: first(params.line), match: first(params.match), basis, open, accounting, limit: 25, offset: (page - 1) * 25 });
  if (!result.invoice) notFound();
  const writable = session.accessMode === "preview" || Boolean(session.permissions?.length) && (session.permissions ?? []).every(p => ["ops:*", "ops:write", "ops:read_write", "ops:store_manage"].includes(p));
  const canDecide = result.invoice.submittedByMembershipId !== session.membershipId && unrestricted && ["executive", "finance"].includes(session.role) && writable;
  const decisionNote = result.invoice.submittedByMembershipId === session.membershipId ? "Another reviewer must review invoices you submitted." : !writable ? "This account has read-only access." : "A company finance reviewer can record a decision.";
  return { result, section, page, line: first(params.line), match: first(params.match), basis, open, scopeLabel: session.scopeLabel, canDecide, decisionNote, updated: first(params.updated) === "decision" };
}
