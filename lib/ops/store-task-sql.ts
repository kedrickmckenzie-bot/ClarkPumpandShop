import type { OpsSqlDriver } from "./sql-driver";
import type { OrganizationScope } from "./repository";
import { scopeWhere } from "./sql-scope";
import type { StoreTask,TaskMessage,TaskParticipant,TaskPerson,TaskQuery,TaskPage,TaskRow } from "./store-task-types";
export function taskRow<T>(raw:Record<string,unknown>):T { return Object.fromEntries(Object.entries(raw).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase()),v])) as T; }
const grant = `(g.scope_kind = 'organization' AND g.scope_id = s.organization_id OR g.scope_kind = 'division' AND g.scope_id = s.division_id OR g.scope_kind = 'region' AND g.scope_id = s.region_id OR g.scope_kind = 'store' AND g.scope_id = s.id)`;
const write = `g.permission IN ('ops:*','ops:write','ops:read_write','ops:store_manage')`;
export async function taskPeopleSql(d:OpsSqlDriver,org:string,store:string,search:string,localOnly=false):Promise<TaskPerson[]> {
 const rows=(await d.query({sql:`SELECT m.id,u.display_name AS name,m.role,CASE WHEN EXISTS (SELECT 1 FROM ops_scope_grants g WHERE g.organization_id=m.organization_id AND g.membership_id=m.id AND g.scope_kind='store' AND g.scope_id=s.id AND ${write}) THEN 1 ELSE 0 END AS local FROM ops_memberships m JOIN ops_users u ON u.id=m.user_id JOIN ops_stores s ON s.organization_id=m.organization_id AND s.id=? WHERE m.organization_id=? AND m.status='active' AND u.status='active' AND m.role IN ('executive','facilities_admin','regional_manager','field_manager','store_manager','finance_reviewer') AND EXISTS (SELECT 1 FROM ops_scope_grants g WHERE g.organization_id=m.organization_id AND g.membership_id=m.id AND ${write} AND ${grant}) ${localOnly?`AND EXISTS (SELECT 1 FROM ops_scope_grants g WHERE g.organization_id=m.organization_id AND g.membership_id=m.id AND g.scope_kind='store' AND g.scope_id=s.id AND ${write})`:''} AND LOWER(u.display_name || ' ' || m.role) LIKE ? ORDER BY u.display_name,m.id LIMIT 50`,params:[store,org,`%${search.toLowerCase()}%`]})).rows;
 return rows.map(r=>({id:String(r.id),name:String(r.name),role:String(r.role),local:Boolean(r.local)}));
}
export async function taskQuerySql(d:OpsSqlDriver,scope:OrganizationScope,q:TaskQuery):Promise<TaskPage> {
 const p:unknown[]=[]; const filters=[scopeWhere(scope,'s',p)];
 const me=q.membershipId;
 filters.push(`EXISTS (SELECT 1 FROM ops_scope_grants g JOIN ops_memberships m ON m.organization_id=g.organization_id AND m.id=g.membership_id JOIN ops_users u ON u.id=m.user_id WHERE g.organization_id=t.organization_id AND g.membership_id=? AND m.status='active' AND u.status='active' AND m.role IN ('executive','facilities_admin','regional_manager','field_manager','store_manager','finance_reviewer') AND ${write} AND ${grant})`);p.push(me);
 const local=`EXISTS (SELECT 1 FROM ops_scope_grants g WHERE g.organization_id=t.organization_id AND g.membership_id=? AND g.scope_kind='store' AND g.scope_id=t.store_id AND ${write})`;
 const shared=`(t.assignment='responsible' OR (t.assignment='local' AND ${local}))`;
 const participant=`EXISTS (SELECT 1 FROM ops_store_task_people tp WHERE tp.organization_id=t.organization_id AND tp.task_id=t.id AND tp.membership_id=?)`;
 filters.push(`(${q.supervisor?'1=1':participant} OR (t.status='open' AND t.claimant_id IS NULL AND ${shared}))`);
 if(!q.supervisor)p.push(me);p.push(me);
 if(q.storeId){filters.push('t.store_id=?');p.push(q.storeId);}
 if(q.sourceId){filters.push('(t.work_order_id=? OR t.invoice_id=? OR t.visit_id=? OR t.asset_id=?)');p.push(q.sourceId,q.sourceId,q.sourceId,q.sourceId);}
 if(q.search){filters.push("LOWER(t.title || ' ' || s.store_number || ' ' || s.name || ' ' || s.address_1 || ' ' || s.city || ' ' || s.state || ' ' || s.postal_code) LIKE ?");p.push(`%${q.search.toLowerCase()}%`);}
 if(q.view==='mine'){filters.push("((t.status='review' AND t.requester_id=?) OR ((t.status='open' AND (t.claimant_id=? OR (t.claimant_id IS NULL AND t.assignee_id=?))) OR (t.status='open' AND t.fallback_id=? AND t.due_at<?)))");p.push(me,me,me,me,q.now);}
 if(q.view==='shared'){filters.push(`t.status='open' AND t.claimant_id IS NULL AND t.assignment!='person' AND ${shared}`);p.push(me);}
 if(q.view==='waiting'){filters.push(`${participant} AND t.status!='closed' AND NOT (t.status='review' AND t.requester_id=?) AND COALESCE(t.claimant_id,t.assignee_id,'')!=?`);p.push(me,me,me);}
 if(q.view==='history')filters.push("t.status='closed'");
 const from=' FROM ops_store_tasks t JOIN ops_stores s ON s.organization_id=t.organization_id AND s.id=t.store_id';
 const where=' WHERE '+filters.join(' AND ');
 const total=Number((await d.query({sql:'SELECT COUNT(*) AS n'+from+where,params:p})).rows[0]?.n??0);
 const person=(col:string)=>`(SELECT u.display_name FROM ops_memberships m JOIN ops_users u ON u.id=m.user_id WHERE m.organization_id=t.organization_id AND m.id=${col})`;
 const sql=`SELECT t.*,s.store_number,s.name AS store_name,s.time_zone,${person('COALESCE(t.claimant_id,t.assignee_id)')} AS handler_name,${person('t.requester_id')} AS requester_name,${person('t.fallback_id')} AS fallback_name,CASE WHEN EXISTS (SELECT 1 FROM ops_store_task_messages msg JOIN ops_store_task_people tp ON tp.organization_id=msg.organization_id AND tp.task_id=msg.task_id AND tp.membership_id=? WHERE msg.organization_id=t.organization_id AND msg.task_id=t.id AND msg.kind='reply' AND msg.actor_id!=? AND msg.created_at>tp.seen_at) THEN 1 ELSE 0 END AS new_reply${from}${where} ORDER BY CASE WHEN t.priority='urgent' THEN 0 ELSE 1 END,CASE WHEN t.status='open' AND t.due_at<? THEN 0 ELSE 1 END,new_reply DESC,t.due_at,t.updated_at DESC,t.id LIMIT ? OFFSET ?`;
 const rows=(await d.query({sql,params:[me,me,...p,q.now,Math.min(50,Math.max(1,q.limit??25)),Math.max(0,q.offset??0)]})).rows;
 return {items:rows.map(r=>taskRow<TaskRow>(r)),totalCount:total};
}
export async function getTaskSql(d:OpsSqlDriver,org:string,id:string) { const r=(await d.query({sql:'SELECT * FROM ops_store_tasks WHERE organization_id=? AND id=?',params:[org,id]})).rows[0];return r?taskRow<StoreTask>(r):null; }
export async function taskMessagesSql(d:OpsSqlDriver,org:string,id:string,offset=0,kind?:string) {return (await d.query({sql:`SELECT * FROM ops_store_task_messages WHERE organization_id=? AND task_id=? ${kind?'AND kind=?':''} ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?`,params:[org,id,...(kind?[kind]:[]),offset]})).rows.map(r=>taskRow<TaskMessage>(r));}
export async function taskParticipantsSql(d:OpsSqlDriver,org:string,id:string) {return (await d.query({sql:'SELECT * FROM ops_store_task_people WHERE organization_id=? AND task_id=? ORDER BY id',params:[org,id]})).rows.map(r=>taskRow<TaskParticipant>(r));}
