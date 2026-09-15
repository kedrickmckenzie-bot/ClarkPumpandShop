import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest } from "./types";
import { attentionFromFixture, type AttentionAccess, type AttentionQuery, type AttentionQueueRow } from "./attention-query";
import { dashboardPageBounds } from "./dashboard-query";
import { WARRANTY_REVIEW_DONE, WARRANTY_REVIEW_TITLE } from "./warranty-review";

export interface AttentionSource {
  id: string; label: string; href: string; owner: string; dueAt?: string; noDeadline?: string; doneWhen: string;
}
export interface AttentionSourcePage { item: AttentionQueueRow; items: AttentionSource[]; totalCount: number; nextOffset?: number }
export function defaultAttentionSource(item: AttentionQueueRow): AttentionSource {
  return { id: item.id, label: item.title, href: item.linkHref, owner: item.owner, dueAt: item.dueAt, doneWhen: item.reason };
}
export function taskSource(input: { id: string; taskType: string; title: string; assigneeName: string; dueAt?: string; noSlaReason?: string; completionCriteria: string }, item: AttentionQueueRow): AttentionSource {
  return { id: input.id, label: input.taskType === "review_warranty" ? WARRANTY_REVIEW_TITLE : input.title, href: item.linkHref.startsWith("/app/warranties/") ? item.linkHref : item.workOrderId ? `${item.linkHref.split("#")[0]}#workflow-task-${input.id}` : item.linkHref, owner: input.assigneeName, dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : undefined, noDeadline: input.noSlaReason, doneWhen: input.taskType === "review_warranty" ? WARRANTY_REVIEW_DONE : input.completionCriteria };
}
export function sourcePage(item: AttentionQueueRow, rows: AttentionSource[], totalCount: number, request: PageRequest): AttentionSourcePage {
  const { limit, offset } = dashboardPageBounds(request);
  return { item, items: rows.slice(0, limit), totalCount, nextOffset: offset + limit < totalCount ? offset + limit : undefined };
}
export function attentionSourcesFromFixture(fixture: OpsFixture, scope: OrganizationScope, access: AttentionAccess, query: AttentionQuery, itemId: string, request: PageRequest): AttentionSourcePage | null {
  const item = attentionFromFixture(fixture, scope, access, { ...query, cursor: undefined, offset: 0, limit: 1, itemIds: [itemId] }).items[0];
  if (!item) return null;
  const org = scope.organizationId;
  const vendorName = (id: string) => fixture.vendors.find(v => v.organizationId === org && v.id === id)?.name ?? "Vendor";
  let rows: AttentionSource[] = [defaultAttentionSource(item)];
  if (item.sourceKind === "workflow_task") {
    const task = fixture.workflowTasks.find(t => t.organizationId === org && t.id === item.id)!;
    rows = [taskSource(task, item)];
    const follow = fixture.followUps.find(f => f.organizationId === org && f.id === task.sourceFollowUpId && f.workOrderId === task.workOrderId);
    if (follow) rows.push({ id: follow.id, label: follow.nextAction, href: `/app/action-center/${encodeURIComponent(follow.id)}`, owner: follow.accountableParty, dueAt: new Date(follow.dueAt).toISOString(), doneWhen: "Record the follow-up result" });
    const approval = fixture.approvalRequests.find(a => a.organizationId === org && a.id === task.sourceApprovalRequestId && a.storeId === item.storeId && (a.subjectType === "work_order" ? a.subjectId === task.workOrderId : a.subjectId === task.serviceRequestId));
    if (approval) rows.push({ id: approval.id, label: "Approval request", href: item.linkHref, owner: item.owner, dueAt: approval.dueAt ? new Date(approval.dueAt).toISOString() : undefined, doneWhen: "Authorized reviewer records a decision" });
  } else if (item.sourceKind === "quote_round") {
    const requests = fixture.estimateRequests.filter(q => q.organizationId === org && q.workOrderId === item.workOrderId && ["requested","opened","submitted"].includes(q.status));
    rows = requests.map(q => ({ id: q.id, label: `Quote request · ${vendorName(q.vendorId)}`, href: `${item.linkHref.split("#")[0]}#quote-request-${q.id}`, owner: vendorName(q.vendorId), dueAt: q.dueAt ? new Date(q.dueAt).toISOString() : undefined, doneWhen: "Vendor submits a quote or declines" }));
    rows.push(...fixture.estimateProposals.filter(p => p.organizationId === org && requests.some(q => q.id === p.requestId && q.workOrderId === p.workOrderId && q.vendorId === p.vendorId)).map(p => ({ id: p.id, label: `Quote version ${p.revision} · ${vendorName(p.vendorId)}`, href: `${item.linkHref.split("#")[0]}#quote-proposal-${p.id}`, owner: item.owner, doneWhen: "Review this version when choosing a quote" })));
  }
  rows.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const { limit, offset } = dashboardPageBounds(request);
  return sourcePage(item, rows.slice(offset, offset + limit), rows.length, request);
}
