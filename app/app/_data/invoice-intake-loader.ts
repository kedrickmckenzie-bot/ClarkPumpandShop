import "server-only";
import { notFound } from "next/navigation";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "./operator-loader";
import type { InvoiceIntakeQuery } from "@/lib/ops/invoice-intake-query";

export async function loadInvoiceIntake(params: Record<string, string | string[] | undefined> = {}) {
  const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  const session = await loadOperatorSession();
  const writable = session.accessMode === "preview" || Boolean(session.permissions?.length) && session.permissions!.every(p => ["ops:*", "ops:write", "ops:read_write", "ops:store_manage"].includes(p));
  if (!writable || !["executive", "facilities", "finance"].includes(session.role) || session.storeIds !== undefined || session.regionIds !== undefined) notFound();
  const repository = await getServerOpsRepository(), org = session.organizationId;
  const workId = first(params.work), work = workId ? await repository.getWorkOrder(org, workId) : null;
  if (workId && (!work || work.status === "cancelled")) notFound();
  const store = work ? await repository.getStore(org, work.storeId) : null;
  if (work && !store) notFound();
  const assignment = work ? await repository.getActiveAssignment(org, work.id) : null;
  const vendorId = first(params.vendor) ?? (assignment?.kind === "outside_vendor" ? assignment.vendorId : undefined);
  let vendor = vendorId ? await repository.getVendor(org, vendorId) : null;
  if (first(params.vendor) && (!vendor || vendor.status === "inactive")) notFound();
  if (vendor?.status === "inactive") vendor = null;
  const agreementId = first(params.agreement), agreement = agreementId ? await repository.getContractVersion(org, agreementId) : null;
  if (agreementId && (!agreement || agreement.vendorId !== vendor?.id || agreement.status !== "active")) notFound();
  const choose = first(params.choose);
  const kind: InvoiceIntakeQuery["kind"] | undefined = !work ? "work" : choose === "vendor" || !vendor ? "vendor" : choose === "agreement" ? "agreement" : undefined;
  const search = first(params.q)?.trim().slice(0, 160) ?? "", requested = Number(first(params.page) ?? 1), page = Number.isSafeInteger(requested) && requested > 0 && requested <= 1_000_000 ? requested : 1;
  const options = kind ? await repository.listInvoiceIntakeOptions(session, { kind, search, vendorId: vendor?.id, limit: 25, offset: (page - 1) * 25 }) : undefined;
  return { scopeLabel: session.scopeLabel, work: work ? { id: work.id, number: work.number, problem: work.problem, storeNumber: store!.storeNumber } : undefined, vendor: vendor ? { id: vendor.id, name: vendor.name } : undefined, agreement: agreement ? { id: agreement.id, label: `${agreement.sourceAgreementReference} · Version ${agreement.version}` } : undefined, kind, options, search, page };
}
