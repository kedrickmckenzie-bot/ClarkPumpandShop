"use client";

import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { roleCan } from "@/components/ops/role-policy";
import { dueLabel, canPlanJob, dispatchPlanLabel, dispatchStatus, orderedStops, type DispatchJob } from "@/lib/ops/dispatch-board";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { DispatchBoardProps, type DispatchSaveReceipt, JobSheet, Sheet } from "./dispatch-board";
import styles from "./dispatch-assign-board.module.css";

type Technician = {id:string;name:string;homeRegionId?:string;skills:string[];items:DispatchJob[];totalCount?:number;nextCursor?:string;current?:DispatchJob;next?:DispatchJob;todayPage?:{items:DispatchJob[];nextCursor?:string;totalCount?:number}};
type Selection = {job:DispatchJob;mode?:string;person?:{id:string;name:string};day?:string};
const dayName=(date:string)=>cachedDateTimeFormat("en-US",{timeZone:"UTC",weekday:"short"}).format(new Date(`${date}T12:00:00Z`));
const skillName=(value:string)=>value.replaceAll("_"," ");
function ProblemSummary({text}:{text:string}) {
  const ref=useRef<HTMLParagraphElement>(null),[summary,setSummary]=useState(text);
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    const measure=()=>{
      const context=document.createElement("canvas").getContext("2d");if(!context)return;
      context.font=getComputedStyle(element).font;
      const width=element.clientWidth-8,words=text.split(/\s+/);let line="",result="",lines=1;
      for(const word of words){
        const candidate=line?`${line} ${word}`:word;
        if(context.measureText(candidate+"…").width>width){if(lines===2)break;lines++;line=word;}else line=candidate;
        result=result?`${result} ${word}`:word;
      }
      setSummary(result===text?text:result+"…");
    };
    const observer=new ResizeObserver(measure);observer.observe(element);void document.fonts.ready.then(measure);return()=>observer.disconnect();
  },[text]);
  return <p ref={ref} title={text}>{summary}</p>;
}
export function DispatchAssignBoard(props:DispatchBoardProps & {commitments:Technician[]}) {
  const router=useRouter(), manager=roleCan(props.session,"assign_internal_work");
  const [picked,setPicked]=useState<DispatchJob>(),[selection,setSelection]=useState<Selection>(),[chooser,setChooser]=useState(false);
  const [expanded,setExpanded]=useState<string[]>([]),[compared,setCompared]=useState<string[]>([]),[compare,setCompare]=useState(false),[saved,setSaved]=useState(props.initialSaved);
  const [receipt,setReceipt]=useState<DispatchSaveReceipt>(),[undoPending,setUndoPending]=useState(false);
  const drag=useRef<DispatchJob|undefined>(undefined),opener=useRef<HTMLElement|null>(null);
  async function undo() {
    if(!receipt||undoPending)return;
    setUndoPending(true);
    try {
      const response=await fetch(`/api/ops/internal-dispatch/jobs/${encodeURIComponent(receipt.previous.id)}`);
      const detail=await response.json() as {job:DispatchJob;error?:string};
      if(!response.ok)throw Error(detail.error??"Could not load the saved job.");
      const current=detail.job, previous=receipt.previous;
      if(current.version!==receipt.version)throw Error("This job changed after your save. Open it to review the latest work; Undo is no longer available.");
      const data=new FormData();
      const scheduling=Boolean(previous.schedule);
      Object.entries({action:scheduling?"schedule":"assign",expectedVersion:String(receipt.version),expectedAssignmentId:current.assignmentId??"",expectedScheduleId:current.schedule?.id??"",submissionKey:crypto.randomUUID(),internalTarget:previous.internalTarget??"pool",internalMembershipId:previous.internalMembershipId??"",managerId:previous.internalTarget==="awaiting_allocation"?previous.internalAccountableId??"":"",reason:"Undo last Dispatch change"}).forEach(([key,value])=>data.set(key,value));
      if(scheduling){
        const plan=previous.schedule;
        data.set("precision",plan?.precision??"removed");
        if(plan){
          data.set("date",plan.day??plan.week);
          if(plan.localStart)data.set("localStart",plan.localStart);
          if(plan.disambiguation)data.set("disambiguation",plan.disambiguation);
          if(plan.durationMinutes)data.set("durationMinutes",String(plan.durationMinutes));
          if(plan.tentative)data.set("tentative","yes");
          if(plan.reviewReason)data.set("reviewReason",plan.reviewReason);
        }
      }
      const result=await fetch(`/api/ops/work-orders/${encodeURIComponent(previous.id)}/${scheduling?"internal-schedule":"internal-dispatch"}`,{method:"POST",headers:{Accept:"application/json"},body:data});
      const body=await result.json() as {error?:string};
      if(!result.ok)throw Error(body.error??"Undo needs a review. Open the job to check its date.");
      setSaved("Saved · Previous assignment and date restored.");setReceipt(undefined);router.refresh();
    }catch(error){setSaved(error instanceof Error?error.message:"Could not undo. Open the job to review.");setReceipt(undefined);}finally{setUndoPending(false);}
  }
  const techs=props.commitments.filter(t=>!props.filters.person||t.id===props.filters.person);
  const close=()=>{setSelection(undefined);setChooser(false);setCompare(false);requestAnimationFrame(()=>opener.current?.focus());};
  function open(job:DispatchJob,mode?:string,person?:Technician,day?:string){opener.current=document.activeElement as HTMLElement;setChooser(false);setCompare(false);setSelection({job,mode,person,day});}
  const choose=(job:DispatchJob)=>{setPicked(job);opener.current=document.activeElement as HTMLElement;setChooser(window.innerWidth<=600);};
  const toggle=(id:string)=>setExpanded(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const storeName=(job:DispatchJob)=>job.storeName.replace(`${props.session.organizationName} - `, "");
  const region=(tech:Technician)=>props.regions.find(r=>r.id===tech.homeRegionId)?.name??"Home region not entered";
  const match=(tech:Technician)=>picked?<span className={styles.match}>{picked.storeRegionId&&tech.homeRegionId?(picked.storeRegionId===tech.homeRegionId?"Same region":"Different region"):"Region unknown"} · {picked.categoryKey&&tech.skills.includes(picked.categoryKey)?"Skill match":"No listed skill match"}</span>:null;
  const todayJobs=(tech:Technician)=>tech.todayPage?.items??orderedStops(tech.items.filter(job=>job.schedule?.day===props.day));
  const preview=(tech:Technician)=>({current:tech.current,next:tech.next});
  const summary=(job:DispatchJob|undefined,label:string)=><div className={styles.summary}><span>{label}</span>{job?<><strong>{job.storeNumber} · {storeName(job)}</strong><ProblemSummary text={job.problem}/><small>{job.schedule?.durationMinutes?`${job.schedule.durationMinutes/60} h estimated`:"Duration unknown"}</small></>:<p>{label==="Current job"?"No work reported started":"No next stop scheduled"}</p>}</div>;
  const jobCard=(job:DispatchJob,assign=false,actions=true)=><article key={job.id} className={`${styles.card} ${picked?.id===job.id?styles.selected:""}`} draggable={manager&&canPlanJob(job)} onDragStart={()=>{drag.current=job;setPicked(job);}} onDragEnd={()=>{drag.current=undefined;}}>
    <div className={styles.cardTop}><strong>{job.storeNumber} · {storeName(job)}</strong>{["urgent","emergency"].includes(job.priority)?<span className={styles.urgent}>Urgent</span>:null}</div>
    <p>{job.problem}</p><span className={styles.status} data-tone={dispatchStatus(job).tone}>{dispatchStatus(job).label}</span>
    <div className={styles.meta}>{dispatchPlanLabel(job.schedule,props.organizationZone)} · {job.schedule?.durationMinutes?`${job.schedule.durationMinutes/60} h estimated`:"Duration unknown"}</div>
    {job.dueAt?<div className={styles.due}>{dueLabel(job,props.today,props.organizationZone)}</div>:null}
    {actions?<div className={styles.actions}>{manager&&canPlanJob(job)&&!job.hasOpenFollowUp&&!job.visitHoldPosture?<button onClick={()=>choose(job)}>{assign?"Assign":"Reassign"}</button>:null}<button className={styles.quietButton} onClick={()=>open(job)}>View job</button></div>:null}
  </article>;
  const drop=(person:Technician,day?:string)=>{const job=drag.current;drag.current=undefined;if(job&&manager&&canPlanJob(job))open(job,day?"schedule":"assign",person,day);};
  const techRow=(tech:Technician,chooseMode=false)=>{const {current,next}=preview(tech);return <article className={styles.tech} key={tech.id} onDragOver={e=>{if(manager&&drag.current)e.preventDefault();}} onDrop={e=>{e.preventDefault();drop(tech);}}>
    <div className={styles.row}>
      <div className={styles.person}><Link href={`/app/dispatch/technicians/${encodeURIComponent(tech.id)}`}>{tech.name}</Link><span>{region(tech)}</span><span className={styles.skills}>{tech.skills.length?tech.skills.map(skillName).join(" · "):"Skills not entered"}</span>{chooseMode?match(tech):null}</div>
      {summary(current,"Current job")}{summary(next,"Next planned stop")}
      <div className={styles.rowActions}>{chooseMode?<button className={styles.primary} onClick={()=>picked&&open(picked,"assign",tech)}>Choose {tech.name.split(" ")[0]}</button>:<>{manager&&picked&&canPlanJob(picked)?<button className={styles.primary} onClick={()=>open(picked,"assign",tech)}>Assign</button>:null}<button aria-expanded={expanded.includes(tech.id)} onClick={()=>toggle(tech.id)}>{expanded.includes(tech.id)?"Hide work":"View work"}</button><label><input type="checkbox" checked={compared.includes(tech.id)} disabled={!compared.includes(tech.id)&&compared.length>=2} onChange={()=>setCompared(old=>old.includes(tech.id)?old.filter(x=>x!==tech.id):[...old,tech.id])}/> Compare</label></>}</div>
    </div>
    <div className={styles.days}><span>{tech.totalCount??tech.items.length} open</span>{match(tech)}{Array.from({length:7},(_,i)=>addCalendarDays(props.today,i)).map(day=>{const count=props.dayCounts.find(c=>c.membershipId===tech.id&&c.day===day)?.count??0;return <button key={day} className={count?styles.day:styles.emptyDay} disabled={!manager||!picked||!canPlanJob(picked)} aria-label={`${tech.name}, ${day}, ${count} jobs`} onClick={()=>picked&&open(picked,"schedule",tech,day)} onDragOver={e=>{if(manager&&drag.current)e.preventDefault();}} onDrop={e=>{e.preventDefault();e.stopPropagation();drop(tech,day);}}>{count?<>{day===props.today?"Today":dayName(day)} <strong>{count}</strong></>:<span aria-hidden="true">{dayName(day)}</span>}</button>;})}</div>
    {!chooseMode&&expanded.includes(tech.id)?<div className={styles.expanded}>{tech.items.map(job=>jobCard(job))}{tech.nextCursor?<Link href={`/app/dispatch?view=list&person=${encodeURIComponent(tech.id)}`}>View all {tech.totalCount} jobs</Link>:null}</div>:null}
  </article>;};
  return <section className={styles.workspace}>
    <header className={styles.header}><div><h1>Dispatch</h1><span>{props.queue.totalCount??props.queue.items.length} need a technician · {techs.length} technicians</span></div><Link href="/app/dispatch?view=list">Search all jobs</Link></header>
    <div className={styles.toolbar}><nav aria-label="Dispatch views"><Link aria-current={props.view!=="day"?"page":undefined} href="/app/dispatch?view=assign">Assign</Link><Link aria-current={props.view==="day"?"page":undefined} href="/app/dispatch?view=day">Today</Link></nav><button disabled={compared.length!==2} onClick={()=>{opener.current=document.activeElement as HTMLElement;setCompare(true);}}>Compare{compared.length?` (${compared.length})`:""}</button></div>
    {saved?<p role="status" className={styles.saved}>{saved} {receipt?<button disabled={undoPending} onClick={()=>void undo()}>Undo</button>:null}</p>:null}
    {props.view==="day"?<div className={styles.today}><div>{!techs.some(t=>todayJobs(t).length)?<p>No dated stops for today.</p>:null}{techs.filter(t=>todayJobs(t).length).map(tech=><section key={tech.id} className={styles.todayRow}><h2><Link href={`/app/dispatch/technicians/${encodeURIComponent(tech.id)}`}>{tech.name}</Link></h2><div className={styles.stops}>{todayJobs(tech).map((job,i)=><div key={job.id}><span className={styles.stopNumber}>Stop {i+1}</span>{jobCard(job)}</div>)}</div>{tech.todayPage?.nextCursor?<Link href={`/app/dispatch/technicians/${encodeURIComponent(tech.id)}?view=today`}>View all {tech.todayPage.totalCount} stops</Link>:null}</section>)}</div><aside className={styles.map}><h2>Today’s stores</h2><p>Map view planned</p>{[...new Map(techs.flatMap(todayJobs).map(j=>[j.storeId,j])).values()].map(job=><Link key={job.storeId} href={`/app/stores/${job.storeId}`}>{job.storeNumber} · {storeName(job)}</Link>)}</aside></div>:<div className={styles.board}>
      <aside className={styles.queue}><h2>Needs a tech <span>{props.queue.totalCount??props.queue.items.length}</span></h2>{props.queue.items.map(job=>jobCard(job,true))}{!props.queue.items.length?<p>All matching work has a technician.</p>:null}{props.queue.nextCursor?<Link href={`/app/dispatch?view=assign&queueCursor=${encodeURIComponent(props.queue.nextCursor)}`}>More incoming work</Link>:null}</aside>
      <section className={styles.team}><h2>Team <span>{picked?<>Choosing for {picked.storeNumber} <button onClick={()=>setPicked(undefined)}>Clear selection</button></>:"Current commitments"}</span></h2>{techs.map(tech=>techRow(tech))}{!techs.length?<p>No technicians match this scope.</p>:null}</section>
    </div>}
    {chooser&&picked?<Sheet title="Choose a technician" onClose={close}><div className={styles.chooser}>{jobCard(picked,false,false)}{techs.map(tech=>techRow(tech,true))}</div></Sheet>:null}
    {compare?<Sheet title="Compare technicians" wide onClose={close}><div className={styles.compareWindow}>{picked?<div className={styles.incoming}>{jobCard(picked,false,false)}</div>:null}<div className={styles.compareColumns}>{techs.filter(t=>compared.includes(t.id)).map(tech=><section key={tech.id}><h2>{tech.name}</h2><p>{region(tech)} · {tech.skills.map(skillName).join(" · ")}</p>{match(tech)}{manager&&picked&&canPlanJob(picked)?<button className={styles.primary} onClick={()=>open(picked,"assign",tech)}>Assign to {tech.name.split(" ")[0]}</button>:null}{tech.items.map(job=>jobCard(job))}{tech.nextCursor?<Link href={`/app/dispatch?view=list&person=${encodeURIComponent(tech.id)}`}>View all {tech.totalCount} jobs</Link>:null}</section>)}</div></div></Sheet>:null}
    {selection?<JobSheet selection={selection} manager={manager} organizationZone={props.organizationZone} week={props.week} onClose={close} onSaved={(message,_week,saveReceipt)=>{setReceipt(saveReceipt);setSaved(message);setPicked(undefined);close();router.refresh();}}/>:null}
  </section>;
}
