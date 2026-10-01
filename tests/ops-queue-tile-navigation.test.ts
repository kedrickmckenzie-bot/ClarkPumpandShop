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
 expect(narrowed.metrics?.[2].link?.href).toBe(`/app/action-center?store=${store}`);
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
