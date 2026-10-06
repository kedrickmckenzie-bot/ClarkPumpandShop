import {expect} from "vitest";
import {backfillDispatchDemo} from "@/lib/ops/seed";
import type {OpsRepository} from "@/lib/ops/repository";
import {dispatchOrg} from "./internal-dispatch-regression";
export async function dispatchBackfillRegression(repository:OpsRepository){
  const scope={organizationId:dispatchOrg};
  const plannedQuery={internalOnly:true,scheduleDayFrom:"2020-01-01",dispatchPlanOrder:true,limit:2} as const;
  const planned=await repository.listWorkOrders(scope,plannedQuery);
  expect(planned.items).toHaveLength(2);
  const second=await repository.listWorkOrders(scope,{...plannedQuery,cursor:planned.nextCursor});
  expect(second.items).toHaveLength(2);
  expect(new Set([...planned.items,...second.items].map(row=>row.id)).size).toBe(4);
  const ordered=[...planned.items,...second.items].map(row=>`${row.schedule!.day}|${String(row.schedule!.stopOrder??1000000).padStart(8,"0")}|${row.schedule!.startsAt??"9999"}|${row.id}`);
  expect(ordered).toEqual([...ordered].sort());
  expect((await repository.listWorkOrders({organizationId:dispatchOrg,storeIds:[]},plannedQuery)).items).toEqual([]);
  const original=(await repository.getWorkOrder(dispatchOrg,"dispatch-study-job-25"))!;
  await repository.atomicWrite([{sql:"UPDATE ops_work_orders SET problem = ?, version = ? WHERE organization_id = ? AND id = ?",params:["Customer changed this problem",9,dispatchOrg,original.id]}]);
  await backfillDispatchDemo(repository,"2026-11-01");
  await backfillDispatchDemo(repository,"2026-11-02");
  expect(await repository.getWorkOrder(dispatchOrg,original.id)).toMatchObject({problem:"Customer changed this problem",version:9,dueAt:original.dueAt,internalScheduleId:original.internalScheduleId});
  const people=(await repository.getDispatchFilters({organizationId:dispatchOrg})).people;
  expect(people).toHaveLength(6);expect(people.every(p=>p.skills.length===2&&p.homeRegionId)).toBe(true);
  expect(await repository.getDispatchFilters({organizationId:dispatchOrg,storeIds:[]})).toEqual({people:[],regions:[]});
}
