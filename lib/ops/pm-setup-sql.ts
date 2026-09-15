import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { dashboardPageBounds } from "./dashboard-query";
import { pmScheduleScope } from "./pm-schedule-query";
import { validatePmSetupQuery, type PmSetupQuery, type PmSetupPage, type PmSetupRow } from "./pm-setup-query";

export async function queryPmSetup(driver: OpsSqlDriver, scope: OrganizationScope, query: PmSetupQuery): Promise<PmSetupPage> {
  validatePmSetupQuery(query);
  const pg=driver.dialect==="postgres", params:unknown[]=[];
  const bind=(value:unknown)=>{params.push(value);return "?";};
  const where=scopeWhere(pmScheduleScope(scope,query),"s",params);
  const programWhere=`g.organization_id=${bind(scope.organizationId)} AND g.status='active'${query.program?` AND g.id=${bind(query.program)}`:""} AND EXISTS (SELECT 1 FROM stores)`;
  const templateOrg=bind(scope.organizationId), planProgram=query.program?` AND p.program_id=${bind(query.program)}`:"";
  const clock=pg?`CAST(${bind(query.asOf)} AS TIMESTAMPTZ)`:`julianday(${bind(query.asOf)})`;
  const active=pg?"TRUE":"1", instant=(s:string)=>pg?s:`julianday(${s})`;
  const rules=pg?"jsonb_array_elements_text(g.applicable_asset_types_json) v(value)":"json_each(g.applicable_asset_types_json) v";
  const arrayLength=pg?"jsonb_array_length(g.applicable_asset_types_json)":"json_array_length(g.applicable_asset_types_json)";
  const letter="substr(source,pos,1)", alpha=pg?`${letter} ~ '^[a-z0-9]$'`:`${letter} GLOB '[a-z0-9]'`;
  // Normalize legacy rule aliases inside SQL without returning the tenant's type catalog.
  // The recursive scan has exactly the same ASCII token contract as pmTypeKey.
  const ctes=`WITH RECURSIVE stores AS (SELECT s.* FROM ops_stores s WHERE ${where}),
    programs AS (SELECT g.*,${arrayLength} AS rule_count FROM ops_maintenance_programs g WHERE ${programWhere}),
    templates AS (SELECT t.* FROM ops_equipment_templates t WHERE t.organization_id=${templateOrg} AND t.active=${active}),
    type_values(kind,owner_id,raw) AS (SELECT 'rule',g.id,CAST(v.value AS TEXT) FROM programs g CROSS JOIN ${rules}
      UNION ALL SELECT 'template',id,id FROM templates UNION ALL SELECT 'template',id,name FROM templates),
    type_input AS (SELECT kind,owner_id,CASE WHEN substr(lower(trim(raw)),1,19)='equipment-template-' THEN substr(lower(trim(raw)),20) ELSE lower(trim(raw)) END AS source FROM type_values),
    normalized(kind,owner_id,source,pos,key,separator) AS (
      SELECT kind,owner_id,source,1,CAST('' AS TEXT),1 FROM type_input
      UNION ALL SELECT kind,owner_id,source,pos+1,key || CASE WHEN ${alpha} THEN ${letter} WHEN separator=0 THEN '_' ELSE '' END,CASE WHEN ${alpha} THEN 0 ELSE 1 END FROM normalized WHERE pos<=length(source)),
    type_keys AS (SELECT DISTINCT kind,owner_id,rtrim(key,'_') AS key FROM normalized WHERE pos>length(source)),
    matched_types AS (SELECT DISTINCT r.owner_id AS program_id,t.owner_id AS template_id FROM type_keys r JOIN type_keys t ON t.kind='template' AND t.key=r.key WHERE r.kind='rule'),
    assets AS (SELECT a.* FROM ops_assets a JOIN stores s ON s.organization_id=a.organization_id AND s.id=a.store_id WHERE a.status<>'retired'),
    plans AS (SELECT p.*,s.store_number,s.name AS store_name,a.id AS safe_asset_id,a.name AS asset_name,g.id AS safe_program_id,g.name AS program_name,
      CASE WHEN g.id IS NULL OR p.cadence_days<>g.frequency_days OR p.completion_window_days<>g.due_window_days OR length(COALESCE(p.cadence_override_reason,''))>0 THEN 1 ELSE 0 END AS changed
      FROM ops_pm_plans p JOIN stores s ON s.organization_id=p.organization_id AND s.id=p.store_id
      LEFT JOIN assets a ON a.organization_id=p.organization_id AND a.id=p.asset_id AND a.store_id=p.store_id
      LEFT JOIN ops_maintenance_programs g ON g.organization_id=p.organization_id AND g.id=p.program_id AND g.status='active'
      WHERE p.active=${active}${planProgram}),
    target_base AS (SELECT g.id AS program_id,g.name AS program_name,s.id AS store_id,s.store_number,s.name AS store_name,a.id AS asset_id,a.name AS asset_name,g.frequency_days,g.due_window_days,0 AS store_level
      FROM programs g JOIN matched_types m ON m.program_id=g.id JOIN assets a ON a.equipment_template_id=m.template_id JOIN stores s ON s.id=a.store_id
      UNION ALL SELECT g.id,g.name,s.id,s.store_number,s.name,CAST(NULL AS TEXT),CAST(NULL AS TEXT),g.frequency_days,g.due_window_days,1 FROM programs g CROSS JOIN stores s WHERE g.rule_count=0),
    target_counts AS (SELECT t.*,(SELECT COUNT(*) FROM plans p WHERE p.program_id=t.program_id AND p.store_id=t.store_id AND (p.asset_id=t.asset_id OR (t.asset_id IS NULL AND p.asset_id IS NULL))) AS plan_count FROM target_base t),
    clock AS (SELECT ${clock} AS as_of),
    occurrences AS (SELECT o.*,CASE WHEN o.status IN ('waived','cancelled') THEN o.status WHEN o.completed_at IS NOT NULL OR o.status LIKE 'completed%' THEN 'completed'
      WHEN ${instant("o.window_ends_at")}<clock.as_of THEN 'missed' WHEN ${instant("o.window_starts_at")}>clock.as_of THEN 'scheduled'
      WHEN o.status IN ('unscheduled','proposed','upcoming') THEN 'unscheduled' ELSE 'due' END AS state,p.program_id AS matched_program
      FROM ops_pm_occurrences o JOIN plans p ON p.organization_id=o.organization_id AND p.id=o.plan_id AND p.store_id=o.store_id CROSS JOIN clock),
    summary AS (SELECT (SELECT COUNT(*) FROM programs) AS summary_programs,(SELECT COUNT(*) FROM target_counts) AS summary_targets,
      (SELECT COUNT(*) FROM target_counts WHERE plan_count>0) AS summary_covered,(SELECT COUNT(*) FROM target_counts WHERE plan_count=0) AS summary_gaps,
      (SELECT COUNT(*) FROM plans) AS summary_plans,(SELECT COUNT(*) FROM plans WHERE changed=1) AS summary_changes)`;
  const cols=["id","name","program_id","program_name","store_id","store_number","store_name","asset_id","asset_name","has_asset_reference","has_program_reference","reason","cadence","window_days","anchor","next_window","store_level","matched_types","targets","covered","plans","gaps","changes","due","missed"];
  const numeric=new Set(["has_asset_reference","has_program_reference","cadence","window_days","store_level","matched_types","targets","covered","plans","gaps","changes","due","missed"]);
  const select=(fields:Record<string,string>)=>cols.map(key=>`${fields[key]??(numeric.has(key)?"0":"NULL")} AS ${key}`).join(",");
  let selected:string;
  if(query.kind==="programs") selected=`SELECT ${select({id:"g.id",name:"g.name",program_id:"g.id",program_name:"g.name",cadence:"g.frequency_days",window_days:"g.due_window_days",anchor:"g.schedule_anchor_at",
    store_level:"CASE WHEN g.rule_count=0 THEN 1 ELSE 0 END",matched_types:"(SELECT COUNT(*) FROM matched_types m WHERE m.program_id=g.id)",
    targets:"(SELECT COUNT(*) FROM target_counts t WHERE t.program_id=g.id)",covered:"(SELECT COUNT(*) FROM target_counts t WHERE t.program_id=g.id AND t.plan_count>0)",
    gaps:"(SELECT COUNT(*) FROM target_counts t WHERE t.program_id=g.id AND t.plan_count=0)",plans:"(SELECT COUNT(*) FROM plans p WHERE p.program_id=g.id)",changes:"(SELECT COUNT(*) FROM plans p WHERE p.program_id=g.id AND p.changed=1)",
    due:"(SELECT COUNT(*) FROM occurrences o WHERE o.matched_program=g.id AND o.state='due')",missed:"(SELECT COUNT(*) FROM occurrences o WHERE o.matched_program=g.id AND o.state='missed')",
    next_window:`(SELECT MIN(${instant("o.window_starts_at")}) FROM occurrences o WHERE o.matched_program=g.id AND o.state='scheduled')`})} FROM programs g`;
  else if(query.kind==="targets") selected=`SELECT ${select({id:"t.program_id || ':' || COALESCE(t.asset_id,t.store_id)",name:"COALESCE(t.asset_name,'Store maintenance')",program_id:"t.program_id",program_name:"t.program_name",store_id:"t.store_id",store_number:"t.store_number",store_name:"t.store_name",asset_id:"t.asset_id",asset_name:"t.asset_name",cadence:"t.frequency_days",window_days:"t.due_window_days",store_level:"t.store_level",targets:"1",plans:"t.plan_count",covered:"CASE WHEN t.plan_count>0 THEN 1 ELSE 0 END",gaps:"CASE WHEN t.plan_count=0 THEN 1 ELSE 0 END"})} FROM target_counts t`;
  else selected=`SELECT ${select({id:"p.id",name:"p.name",program_id:"p.safe_program_id",program_name:"p.program_name",store_id:"p.store_id",store_number:"p.store_number",store_name:"p.store_name",asset_id:"p.safe_asset_id",asset_name:"p.asset_name",has_asset_reference:"CASE WHEN p.asset_id IS NULL THEN 0 ELSE 1 END",has_program_reference:"CASE WHEN p.program_id IS NULL THEN 0 ELSE 1 END",reason:"p.cadence_override_reason",cadence:"p.cadence_days",window_days:"p.completion_window_days",changes:"p.changed"})} FROM plans p`;
  const filters:string[]=[]; if(query.kind==="plans" && query.asset) filters.push(query.asset==="store"?"has_asset_reference=0":`asset_id=${bind(query.asset)}`); if(query.filter==="gaps")filters.push("gaps>0"); if(query.filter==="changes")filters.push("changes>0"); const filter=filters.length?` WHERE ${filters.join(" AND ")}`:""; const binary=pg?'COLLATE "C"':"COLLATE BINARY",{limit,offset}=dashboardPageBounds(query);
  const result=await driver.query({sql:`${ctes}, candidates AS (${selected}), selected AS (SELECT * FROM candidates${filter}),total AS (SELECT COUNT(*) AS total_count FROM selected),visible AS (SELECT * FROM selected ORDER BY id ${binary} LIMIT ${bind(limit)} OFFSET ${bind(offset)}) SELECT visible.*,summary.*,total.total_count FROM summary CROSS JOIN total LEFT JOIN visible ON 1=1 ORDER BY visible.id ${binary}`,params});
  const first=result.rows[0]??{},totalCount=Number(first.total_count??0);
  const items:PmSetupRow[]=result.rows.filter(r=>r.id!=null).map(r=>{
    const opt=(key:string)=>r[key]==null?undefined:String(r[key]), num=(key:string)=>Number(r[key]??0);
    return {id:String(r.id),name:String(r.name),programId:opt("program_id"),programName:opt("program_name"),storeId:opt("store_id"),storeNumber:opt("store_number"),storeName:opt("store_name"),assetId:opt("asset_id"),assetName:opt("asset_name"),
      ...(query.kind==="plans"?{hasAssetReference:Boolean(num("has_asset_reference")),hasProgramReference:Boolean(num("has_program_reference")),reason:opt("reason")}:{}),
      cadence:num("cadence"),window:num("window_days"),...(query.kind==="programs"?{anchor:r.anchor==null?undefined:new Date(String(r.anchor)).toISOString(),nextWindow:r.next_window==null?undefined:new Date(pg?String(r.next_window):(Number(r.next_window)-2440587.5)*86400000).toISOString()}:{}),
      storeLevel:Boolean(num("store_level")),matchedTypes:num("matched_types"),targets:num("targets"),covered:num("covered"),plans:num("plans"),gaps:num("gaps"),changes:num("changes"),due:num("due"),missed:num("missed")};
  });
  return {items,totalCount,summary:{programs:Number(first.summary_programs??0),targets:Number(first.summary_targets??0),covered:Number(first.summary_covered??0),gaps:Number(first.summary_gaps??0),plans:Number(first.summary_plans??0),changes:Number(first.summary_changes??0)},nextOffset:offset+limit<totalCount?offset+limit:undefined};
}
