import type { OperatorSession, PaginationViewModel, ProgramPageViewModel, TableRowViewModel } from "@/components/ops/data-contract";
import type { PmProgramManagementModel } from "@/components/workspace/pm-program-management";
import type { OpsRepository } from "@/lib/ops/repository";
import { type PmSetupQuery, type PmSetupRow } from "@/lib/ops/pm-setup-query";
import { pmScheduleScope } from "@/lib/ops/pm-schedule-query";
import { compactStoreLabel } from "@/lib/product/store-label";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { roleCan } from "@/components/ops/role-policy";
import { pmHref } from "./pm-schedule-presenter";

type Query=Record<string,string|string[]|undefined>;
const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
const number=(v:string|string[]|undefined)=>{const n=Number(first(v)??1);return Number.isSafeInteger(n)&&n>0&&n<=1_000_000?n:1;};
const base=(query:Query,asOf:string)=>({asOf,store:first(query.store),region:first(query.region),program:first(query.program),asset:first(query.asset)});
const storeLabel=(r:PmSetupRow,s:OperatorSession)=>compactStoreLabel(`Store ${r.storeNumber} · ${r.storeName}`,s.organizationName);
const source=(q:Query,kind:string,filter="all",program?:string)=>pmHref(q,{setup:kind,setupFilter:filter,program:program??first(q.program),setupPage:undefined,evidence:undefined,page:undefined,programPage:undefined,enrollmentPage:undefined});
const ruleLabel=(r:PmSetupRow)=>r.storeLevel?"All stores":r.matchedTypes?`${r.matchedTypes} equipment type${r.matchedTypes===1?"":"s"}`:"Equipment rule needs review";
function pagination(query:Query,key:string,page:number,total:number,size:number):PaginationViewModel|undefined {
  const pages=Math.max(1,Math.ceil(total/size));if(pages===1&&page===1)return;
  return {summary:page<=pages?`Page ${page} of ${pages}`:`${total} records`,currentPage:page,totalPages:pages,pageLinks:[],previousHref:page>1?pmHref(query,{[key]:String(Math.min(page-1,pages))}):undefined,nextHref:page<pages?pmHref(query,{[key]:String(page+1)}):undefined};
}
export async function buildPmSetupSources(repository:OpsRepository,session:OperatorSession,asOf:string,query:Query):Promise<ProgramPageViewModel> {
  const kind=first(query.setup) as PmSetupQuery["kind"],filter=(first(query.setupFilter)??"all") as PmSetupQuery["filter"],page=number(query.setupPage),size=25;
  const result=await repository.listPmSetup(session,{...base(query,asOf),kind,filter,limit:size,offset:(page-1)*size});
  const selected=base(query,asOf),stores=selected.store||selected.region?await repository.searchStores(pmScheduleScope(session,selected),"",{limit:1}):undefined;
  const scopeLabel=selected.store?stores?.items[0]?compactStoreLabel(`Store ${stores.items[0].storeNumber} · ${stores.items[0].name}`,session.organizationName):"Store unavailable":selected.region?`${stores?.items[0]?.regionName??"Region unavailable"} · ${stores?.totalCount??0} stores`:session.scopeLabel;
  const title=kind==="programs"?"Company schedules":kind==="targets"?filter==="gaps"?"Coverage gaps":"Schedule coverage":filter==="changes"?"Store schedule changes":"Store schedules";
  const rows:TableRowViewModel[]=result.items.map(r=>{
    if(kind==="programs")return {id:r.id,label:r.name,href:pmHref(query,{program:r.id,setup:undefined,setupFilter:undefined,setupPage:undefined,view:"all"}),cells:[{key:"name",value:r.name},{key:"rule",value:ruleLabel(r),link:{href:source(query,"targets","all",r.id),label:"Review coverage"}},{key:"cadence",value:`Every ${r.cadence} days`,secondary:`±${r.window} days`},{key:"coverage",value:`${r.covered} of ${r.targets} covered`,secondary:`${r.gaps} gaps`,link:{href:source(query,"targets","all",r.id),label:"Review exact coverage"}}]};
    const target=kind==="targets",href=target?r.assetId?`/app/equipment/${encodeURIComponent(r.assetId)}`:`/app/stores/${encodeURIComponent(r.storeId!)}`:`/app/pm/plans/${encodeURIComponent(r.id)}`;
    return {id:r.id,label:r.name,href,cells:[{key:"target",value:target?r.name:r.assetName??(r.hasAssetReference?"Equipment unavailable":"Store maintenance"),secondary:storeLabel(r,session)},
      {key:"program",value:r.programName??(r.hasProgramReference?"Company schedule unavailable":"Store-created schedule"),secondary:target||r.name===r.programName?undefined:r.name},
      target?{key:"status",value:r.covered?"Covered":"Needs a plan",secondary:r.plans>1?`${r.plans} active plans`:undefined,link:r.covered?{href:pmHref(query,{setup:"plans",setupFilter:"all",setupPage:undefined,store:r.storeId,program:r.programId,asset:r.assetId??"store"}),label:"Review store plans"}:undefined}:
      {key:"status",value:r.programId?r.changes?"Store change":"Company standard":"Store-created",secondary:r.reason},
      {key:"timing",value:`Every ${r.cadence} days`,secondary:`±${r.window} days`}]};
  });
  return {state:{kind:"ready"},page:{title,description:kind==="targets"?"Each row is one schedule and its equipment or store.":"Active schedules in the selected scope.",scopeLabel:selected.program?`${scopeLabel} · ${result.items[0]?.programName??"Selected schedule"}`:scopeLabel,periodLabel:"Current setup",secondaryAction:{label:"Back to PM schedule",href:pmHref(query,{setup:undefined,setupFilter:undefined,setupPage:undefined,asset:undefined})}},metrics:[],priorityActions:[],breakdowns:[],trends:[],
    sourceDescription:kind==="targets"?`${result.totalCount} coverage targets · counted once per company schedule`:"",
    filters:kind==="targets"?[{id:"coverage",label:"Coverage",options:[{value:"all",label:"All targets",selected:filter!=="gaps",href:source(query,kind)},{value:"gaps",label:"Needs a plan",selected:filter==="gaps",href:source(query,kind,"gaps")}]}]:undefined,
    table:{id:"pm-setup-evidence",caption:title,rows,columns:kind==="programs"?[{key:"name",label:"Schedule"},{key:"rule",label:"Applies to"},{key:"cadence",label:"Timing"},{key:"coverage",label:"Coverage"}]:[{key:"target",label:"Equipment / store"},{key:"program",label:"Company schedule"},{key:"status",label:kind==="targets"?"Coverage":"Schedule source"},{key:"timing",label:"Timing"}]},resultSummary:`${rows.length?(page-1)*size+1:0}–${rows.length?(page-1)*size+rows.length:0} of ${result.totalCount}`,pagination:pagination(query,"setupPage",page,result.totalCount,size)};
}
export async function buildPmSetupManagement(repository:OpsRepository,session:OperatorSession,asOf:string,query:Query):Promise<PmProgramManagementModel> {
  const programPage=number(query.programPage),planPage=number(query.enrollmentPage),mode=first(query.store)?"store":first(query.enrollments)==="all"?"all":"exceptions";
  const [programs,plans]=await Promise.all([repository.listPmSetup(session,{...base(query,asOf),kind:"programs",limit:25,offset:(programPage-1)*25}),repository.listPmSetup(session,{...base(query,asOf),kind:"plans",filter:mode==="exceptions"?"changes":"all",limit:20,offset:(planPage-1)*20})]);
  const resultLabel=`${plans.items.length?(planPage-1)*20+1:0}–${plans.items.length?(planPage-1)*20+plans.items.length:0} of ${plans.totalCount}`;
  return {scopeLabel:session.scopeLabel,canCreateMasterSchedule:(session.role==="executive"||session.role==="facilities")&&roleCan(session,"setup_pm"),
    programsHref:source(query,"programs"),targetsHref:source(query,"targets"),gapsHref:source(query,"targets","gaps"),enrolledPlansHref:source(query,"plans"),attentionHref:pmHref(query,{view:"attention"}),
    summary:{activePrograms:programs.summary.programs,matchingEquipment:programs.summary.targets,enrolledPlans:programs.summary.plans,coverageGaps:programs.summary.gaps,localOverrides:programs.summary.changes,evidenceReviews:0},
    programs:programs.items.map(r=>({id:r.id,name:r.name,serviceAreaLabel:"",equipmentTypeLabels:[ruleLabel(r)],cadenceLabel:`Every ${r.cadence} days`,windowLabel:`±${r.window} days`,anchorLabel:r.anchor?formatOperationsDate(r.anchor):"Not set",matchingEquipment:r.targets,enrolledPlans:r.plans,coveredTargets:r.covered,coverageGaps:r.gaps,localOverrides:r.changes,dueOccurrences:r.due,missedOccurrences:r.missed,nextWindowLabel:r.nextWindow?`Next window ${formatOperationsDate(r.nextWindow)}`:"No future window",href:pmHref(query,{program:r.id,view:"attention",status:undefined,page:undefined,programPage:undefined,enrollmentPage:undefined}),coverageHref:source(query,"targets","all",r.id),gapsHref:source(query,"targets","gaps",r.id),selected:first(query.program)===r.id})),
    programPagination:pagination(query,"programPage",programPage,programs.totalCount,25),
    plans:plans.items.map(r=>({id:r.id,planName:r.name,storeLabel:storeLabel(r,session),assetLabel:r.assetName??(r.hasAssetReference?"Equipment unavailable":"Store maintenance"),storeHref:`/app/stores/${encodeURIComponent(r.storeId!)}`,assetHref:r.assetId?`/app/equipment/${encodeURIComponent(r.assetId)}`:undefined,programName:r.programName??(r.hasProgramReference?"Company schedule unavailable":"Store-created schedule"),cadenceLabel:`Every ${r.cadence} days · ±${r.window} days`,sourceLabel:r.programId?r.changes?"Store change":"Company standard":"Store-created",overrideReason:r.reason,href:`/app/pm/plans/${encodeURIComponent(r.id)}`})),
    planView:{mode,title:mode==="exceptions"?"Store schedule changes":"Store schedules",description:mode==="exceptions"?"Local timing changes and store-created plans.":"Active plans in this scope.",resultLabel,toggleHref:mode==="store"?undefined:pmHref(query,{enrollments:mode==="all"?"exceptions":"all",enrollmentPage:undefined}),toggleLabel:mode==="store"?undefined:mode==="all"?"Show local changes":"Show all plans",pagination:pagination(query,"enrollmentPage",planPage,plans.totalCount,20)},reconciliations:[]};
}
