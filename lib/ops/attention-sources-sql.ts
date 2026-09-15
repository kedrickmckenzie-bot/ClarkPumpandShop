import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import type { PageRequest } from "./types";
import type { AttentionAccess, AttentionQuery } from "./attention-query";
import { queryAttention } from "./attention-sql";
import { dashboardPageBounds } from "./dashboard-query";
import { defaultAttentionSource, sourcePage, taskSource, type AttentionSource, type AttentionSourcePage } from "./attention-sources";

export async function queryAttentionSources(driver: OpsSqlDriver, scope: OrganizationScope, access: AttentionAccess, query: AttentionQuery, itemId: string, request: PageRequest): Promise<AttentionSourcePage | null> {
  const item = (await queryAttention(driver, scope, access, { ...query, cursor: undefined, offset: 0, limit: 1, itemIds: [itemId] })).items[0];
  if (!item) return null;
  const { limit, offset } = dashboardPageBounds(request);
  if (!["workflow_task","quote_round"].includes(item.sourceKind)) return sourcePage(item, offset ? [] : [defaultAttentionSource(item)], 1, request);
  const params: unknown[] = [];
  const bind = (value: unknown) => { params.push(value); return "?"; };
  const org = bind(scope.organizationId);
  const columns = ["id","kind","label","owner","due_at","no_deadline","done_when","task_type","revision","vendor_name"];
  const select = (values: Record<string,string>) => columns.map(key => `${values[key] ?? "NULL"} AS ${key}`).join(",");
  let cte: string, sources: string;
  if (item.sourceKind === "workflow_task") {
    cte = `parent AS (SELECT * FROM ops_workflow_tasks WHERE organization_id=${org} AND id=${bind(item.id)})`;
    sources = `SELECT ${select({ id:"t.id",kind:"'task'",label:"t.title",owner:"t.assignee_name",due_at:"t.due_at",no_deadline:"t.no_sla_reason",done_when:"t.completion_criteria",task_type:"t.task_type" })} FROM parent t
      UNION ALL SELECT ${select({id:"f.id",kind:"'follow'",label:"f.next_action",owner:"f.accountable_party",due_at:"f.due_at",done_when:"'Record the follow-up result'"})} FROM parent t JOIN ops_follow_ups f ON f.organization_id=t.organization_id AND f.id=t.source_follow_up_id AND f.work_order_id=t.work_order_id
      UNION ALL SELECT ${select({id:"a.id",kind:"'approval'",label:"'Approval request'",owner:"t.assignee_name",due_at:"a.due_at",done_when:"'Authorized reviewer records a decision'"})} FROM parent t JOIN ops_approval_requests a ON a.organization_id=t.organization_id AND a.id=t.source_approval_request_id AND a.store_id=${bind(item.storeId)} AND ((a.subject_type='work_order' AND a.subject_id=t.work_order_id) OR (a.subject_type='service_request' AND a.subject_id=t.service_request_id))`;
  } else {
    cte = `requests AS (SELECT q.* FROM ops_work_order_estimate_requests q WHERE q.organization_id=${org} AND q.work_order_id=${bind(item.workOrderId)} AND q.status IN ('requested','opened','submitted'))`;
    sources = `SELECT ${select({id:"q.id",kind:"'quote'",owner:"COALESCE(v.name,'Vendor')",due_at:"q.due_at",done_when:"'Vendor submits a quote or declines'",vendor_name:"COALESCE(v.name,'Vendor')"})} FROM requests q LEFT JOIN ops_vendors v ON v.organization_id=q.organization_id AND v.id=q.vendor_id
      UNION ALL SELECT ${select({id:"p.id",kind:"'proposal'",done_when:"'Review this version when choosing a quote'",revision:"p.revision",vendor_name:"COALESCE(v.name,'Vendor')"})} FROM requests q JOIN ops_vendor_estimate_proposals p ON p.organization_id=q.organization_id AND p.request_id=q.id AND p.work_order_id=q.work_order_id AND p.vendor_id=q.vendor_id LEFT JOIN ops_vendors v ON v.organization_id=p.organization_id AND v.id=p.vendor_id`;
  }
  const binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  const result = await driver.query({ sql:`WITH ${cte}, sources AS (${sources}), total AS (SELECT COUNT(*) AS count FROM sources), visible AS (SELECT * FROM sources ORDER BY id ${binary} LIMIT ${bind(limit)} OFFSET ${bind(offset)}) SELECT visible.*,total.count FROM total LEFT JOIN visible ON 1=1 ORDER BY visible.id ${binary}`, params });
  const rows: AttentionSource[] = result.rows.filter(row => row.id != null).map(row => {
    const id=String(row.id),dueAt=row.due_at ? new Date(String(row.due_at)).toISOString() : undefined;
    if (row.kind === "task") return taskSource({id,taskType:String(row.task_type),title:String(row.label),assigneeName:String(row.owner),dueAt,noSlaReason:row.no_deadline == null ? undefined : String(row.no_deadline),completionCriteria:String(row.done_when)},item);
    return {id,label:row.kind === "quote" ? `Quote request · ${row.vendor_name}` : row.kind === "proposal" ? `Quote version ${row.revision} · ${row.vendor_name}` : String(row.label), href:row.kind === "follow" ? `/app/action-center/${encodeURIComponent(id)}` : row.kind === "quote" ? `${item.linkHref.split("#")[0]}#quote-request-${id}` : row.kind === "proposal" ? `${item.linkHref.split("#")[0]}#quote-proposal-${id}` : item.linkHref,owner:row.owner == null ? item.owner : String(row.owner),dueAt,doneWhen:String(row.done_when)};
  });
  return sourcePage(item,rows,Number(result.rows[0]?.count ?? 0),request);
}
