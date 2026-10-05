import {roleCanOpenOperatorHref} from "@/components/ops/role-policy";
import {expect,it} from 'vitest';
import {buildShowcaseFixture} from '@/lib/ops/showcase-fixture';
import {createOpsFixtureReadRepository} from '@/lib/ops/fixture-repository';
import {buildReviewQueue} from '@/app/app/_data/review-queue-presenter';
import {projectAttentionItems} from '@/lib/ops/attention-projection';
import type {OperatorSession} from '@/components/ops/data-contract';
it('keeps scope counts stable and makes tile links replace all list filters',async()=>{
 const f=buildShowcaseFixture('2026-09-29T18:00:00Z'),repo=createOpsFixtureReadRepository(f);
 const session={role:'facilities',organizationId:'org-northline-demo',membershipId:'membership-northline-facilities',scopeLabel:'All stores',demoEdition:'complete'} as OperatorSession;
 const store=f.stores[0].id;
 const base=await buildReviewQueue(repo,session,{store},f.asOf);
 const narrowed=await buildReviewQueue(repo,session,{store,lane:'history',type:'vendor-task',q:'no match',priority:'urgent',page:'2'},f.asOf);
 expect(narrowed.metrics).toEqual(base.metrics);
 expect(narrowed.clearFiltersHref).toBe(`/app/action-center?store=${store}`);
 expect(narrowed.metrics?.map(m=>m.label)).toEqual(['Needs your action','Waiting on others','All open items']);
 expect(narrowed.metrics?.[0].link?.href).toBe(`/app/action-center?lane=mine&store=${store}`);
 expect(narrowed.metrics?.[1].link?.href).toBe(`/app/action-center?lane=waiting&store=${store}`);
 expect(narrowed.metrics?.[2].link?.href).toBe(`/app/action-center?store=${store}&lane=all`);
});
it('shows a held job once, preserves other tasks and moves its review to facilities when due',()=>{
 const f=buildShowcaseFixture('2026-09-29T18:00:00Z');
 const hold=f.workOrderVisitHolds!.find(h=>h.status==='active')!;
 const input={fixture:f,organizationId:'org-northline-demo',storeIds:new Set(f.stores.map(s=>s.id)),includeCompanywide:true,role:'facilities_admin' as const,asOf:f.asOf};
 const first=projectAttentionItems(input).filter(i=>i.workOrderId===hold.workOrderId);
 expect(first.filter(i=>i.sourceKind==='held_work')).toHaveLength(1);
 expect(first.some(i=>i.title==='Approved for a future vendor visit')).toBe(false);
 expect(first.find(i=>i.id===hold.id)?.lane).toBe('upcoming');
 expect(projectAttentionItems({...input,asOf:hold.deadlineAt}).find(i=>i.id===hold.id)?.lane).toBe('mine');
});
it('opens the shared list even when I have personal actions, and keeps All open explicit',async()=>{
 const f=buildShowcaseFixture('2026-09-29T18:00:00Z'),repo=createOpsFixtureReadRepository(f);
 const session={role:'facilities',organizationId:'org-northline-demo',membershipId:'membership-northline-facilities',scopeLabel:'All stores',demoEdition:'complete'} as OperatorSession;
 const opened=await buildReviewQueue(repo,session,{},f.asOf);
 const mine=await buildReviewQueue(repo,session,{lane:'mine'},f.asOf);
 const all=await buildReviewQueue(repo,session,{lane:'all'},f.asOf);
 expect(opened.table.rows.map(r=>r.id)).toEqual(all.table.rows.map(r=>r.id));
 expect(all.resultSummary).toBe(`Showing ${all.metrics![2].value} of ${all.metrics![2].value} open items`);
 const lane=opened.filters!.find(g=>g.id==='attention-lane')!;
 expect(lane.options.find(o=>o.label==='All open')!.href).toBe('/app/action-center?lane=all');
 expect(lane.options.find(o=>o.label==='All open')!.selected).toBe(true);
 // Searching keeps the chosen lane, so a search from All open never falls back to Needs my action.
 expect(all.search!.preservedParameters).toContainEqual({name:'lane',value:'all'});
 expect(mine.search!.preservedParameters).toContainEqual({name:'lane',value:'mine'});
 const searched=await buildReviewQueue(repo,session,{lane:'all',q:'Store'},f.asOf);
 expect(searched.filters!.find(g=>g.id==='attention-lane')!.options.find(o=>o.label==='All open')!.selected).toBe(true);
});

it('shows linked task details and shared review to both managers without changing assignment',async()=>{
 const f=buildShowcaseFixture('2026-10-05T18:00:00Z');
 const task=f.storeTasks!.find(t=>t.workOrderId && t.status==='open')!;
 const member=f.memberships.find(m=>m.role==='field_manager')!;
 const user=f.users.find(u=>u.id===member.userId)!;
 task.assignment='person';task.assigneeId=member.id;task.claimantId=null;task.title='Look at this job';
 const repo=createOpsFixtureReadRepository(f);
 for(const role of ['facilities','regional'] as const){
  const session={role,persona:role==='regional'?'field_manager':undefined,organizationId:f.organizations[0].id,membershipId:role==='regional'?member.id:'membership-northline-facilities',scopeLabel:'All stores',demoEdition:'complete'} as OperatorSession;
  const work=f.workOrders.find(w=>w.id===task.workOrderId)!;
  const page=await buildReviewQueue(repo,session,{q:work.number},f.asOf);
  const cells=page.table.rows.flatMap(row=>row.cells.filter(c=>c.key==='task'));
  expect(cells.length).toBeGreaterThan(0);
  expect(cells.some(c=>c.value.includes(`Task: ${user.displayName} · Look at this job · due`))).toBe(true);
  expect(cells.some(c=>c.link?.href===`/app/tasks/${task.id}`)).toBe(true);
  expect(page.filters!.find(g=>g.id==='attention-lane')!.options.find(o=>o.label==='All open')!.selected).toBe(true);
 }
 expect(roleCanOpenOperatorHref("facilities",`/app/tasks/${task.id}`)).toBe(true);
 expect(roleCanOpenOperatorHref("regional",`/app/tasks/${task.id}`)).toBe(true);
 expect(roleCanOpenOperatorHref("technician",`/app/tasks/${task.id}`)).toBe(false);
 expect(task.assigneeId).toBe(member.id);
 task.status='closed';
 const page=await buildReviewQueue(createOpsFixtureReadRepository(f),{role:'facilities',organizationId:f.organizations[0].id,membershipId:'membership-northline-facilities',scopeLabel:'All stores',demoEdition:'complete'} as OperatorSession,{q:f.workOrders.find(w=>w.id===task.workOrderId)!.number},f.asOf);
 expect(page.table.rows.flatMap(r=>r.cells).some(c=>c.key==='task'&&c.value.includes('Look at this job'))).toBe(false);
});
