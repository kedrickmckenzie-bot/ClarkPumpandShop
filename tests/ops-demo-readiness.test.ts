import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_AS_OF } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createStoreAccess } from "@/lib/ops/store-access";
import { storeVendorsFromFixture } from "@/lib/ops/store-vendors";
it("anchors only a newly created demo while retaining relative dates and original sources",()=>{
  const original=buildNorthlinePresentationFixture(),fresh=buildNorthlinePresentationFixture("2027-02-01");
  const offset=Date.parse(fresh.asOf)-Date.parse(NORTHLINE_AS_OF);
  expect(fresh.asOf).toBe("2027-02-01T18:00:00.000Z");
  expect(fresh.stores).toHaveLength(15);expect(fresh.vendors).toHaveLength(5);
  expect(Date.parse(fresh.workOrders[0].createdAt)-Date.parse(original.workOrders[0].createdAt)).toBe(offset);
  expect(fresh.serviceAppointments!.some(a=>Date.parse(a.startsAt)>Date.parse(fresh.asOf))).toBe(true);
  expect(buildNorthlinePresentationFixture()).toEqual(original);
});
it("issues a hashed store-scoped QR capability with an audit event",async()=>{
  const fixture=buildNorthlinePresentationFixture(),repository=createOpsFixtureRepository(fixture),organizationId=fixture.organizations[0].id,storeId=fixture.stores[0].id;
  const result=await createStoreAccess({repository},{organizationId,storeId,actor:{organizationId,actorType:"user",actorName:"Facilities"}});
  const token=result.publicPath.split("/").at(-1)!;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,"0")).join("");
  expect((await repository.getPublicStoreGatewayByToken({tokenHash:hash,purpose:"store_gateway",now:new Date().toISOString()}))?.store.id).toBe(storeId);
  expect(JSON.stringify(repository.snapshot())).not.toContain(token);
  expect(repository.snapshot().auditEvents.some(e=>e.eventType==="store.access_link_created")).toBe(true);
  await expect(createStoreAccess({repository},{organizationId,storeId,actor:{organizationId:"other",actorType:"user",actorName:"Other"}})).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("matches useful aliases without inventing a roof contractor",()=>{
 const f=buildNorthlinePresentationFixture(),scope={organizationId:f.organizations[0].id};
 for(const term of ["card reader","parking lot pothole","slushie machine"])expect(storeVendorsFromFixture(f,scope,"store-northline-104",{search:term}).items.length).toBeGreaterThan(0);
 expect(storeVendorsFromFixture(f,scope,"store-northline-104",{search:"roof leak"}).items).toEqual([]);
});
