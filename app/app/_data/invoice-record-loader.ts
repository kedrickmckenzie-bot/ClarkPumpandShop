import "server-only";
import { invoiceWork, unmatchedCostGroups } from "@/lib/ops/invoice-cost-recording";
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
  const result = await (await getServerOpsRepository()).readInvoiceRecord(session, id, { section, line: first(params.line), match: first(params.match), flag: first(params.flag), basis, open, accounting, limit: 25, offset: (page - 1) * 25 });
  if (!result.invoice) notFound();
  const writable = session.accessMode === "preview" || Boolean(session.permissions?.length) && (session.permissions ?? []).every(p => ["ops:*", "ops:write", "ops:read_write", "ops:store_manage"].includes(p));
  const canDecide = result.invoice.submittedByMembershipId !== session.membershipId && unrestricted && ["executive", "finance"].includes(session.role) && writable;
  const decisionNote = result.invoice.submittedByMembershipId === session.membershipId ? "Another reviewer must review invoices you submitted." : !writable ? "This account has read-only access." : "A company finance reviewer can record a decision.";
  const repository=await getServerOpsRepository();
  const costWork=canDecide ? await invoiceWork(repository,session.organizationId,id) : null;
  const detail=costWork ? await repository.getWorkOrderDetail(session,costWork.id) : null;
  const costChoices=detail && result.invoice.vendorId ? unmatchedCostGroups(detail.costs,result.invoice.vendorId).map(g=>({value:g.id,label:`Use invoice instead of ${new Intl.NumberFormat("en-US",{style:"currency",currency:g.currency}).format(g.amountMinor/100)} · ${g.rows[0].description}`})) : [];
  const visitTimes=await invoiceVisitTimes(repository,session,id,result.invoice.vendorId);
  return { visitTimes, costChoices, result, section, page, line: first(params.line), match: first(params.match), flag: first(params.flag), basis, open, scopeLabel: session.scopeLabel, canDecide, decisionNote, updated: first(params.updated) === "decision" };
}

/** Check-in and checkout times for visits on the work this invoice is matched to. */
async function invoiceVisitTimes(repository: Awaited<ReturnType<typeof getServerOpsRepository>>, session: Awaited<ReturnType<typeof loadOperatorSession>>, id: string, vendorId?: string) {
  const matches = await repository.readInvoiceRecord(session, id, { section: "matches", limit: 50, offset: 0 });
  const workIds = [...new Set(matches.rows.map(row => row.workId).filter((value): value is string => Boolean(value)))].slice(0, 5);
  const details = await Promise.all(workIds.map(workId => repository.getWorkOrderDetail(session, workId)));
  return details.flatMap(detail => detail ? detail.visits
    .filter(visit => !vendorId || visit.vendorId === vendorId)
    .map(visit => ({ id: visit.id, workId: detail.id, workNumber: detail.number, technician: visit.technicianName, checkedInAt: visit.checkedInAt, checkedOutAt: visit.checkedOutAt, seconds: visit.checkedOutAt ? visit.approximateObservedSeconds : undefined, timeZone: visit.storeTimeZone })) : [])
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
}
