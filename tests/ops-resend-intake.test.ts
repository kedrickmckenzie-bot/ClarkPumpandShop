import {describe,expect,it,vi} from "vitest";
import {verifyResendSignature,readResendEmail} from "@/lib/server/resend-email-intake";
import {receiveEmail,routeVerifiedEmail} from "@/lib/ops/email-intake";
import {buildNorthlinePresentationFixture} from "@/lib/ops/fixtures";
import {createOpsFixtureRepository} from "@/lib/ops/fixture-repository";
describe("receiving provider boundary",()=>{
  it("accepts the provider's published signature vector and rejects changed payloads",async()=>{
    const body='{"event_type":"ping","data":{"success":true}}';
    const headers=new Headers({"svix-id":"msg_loFOjxBNrRLzqYUf","svix-timestamp":"1731705121","svix-signature":"v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0="});
    expect(await verifyResendSignature(body,headers,"whsec_plJ3nmyCDGBKInavdOK15jsl",1731705121000)).toBe(true);
    expect(await verifyResendSignature(body+" ",headers,"whsec_plJ3nmyCDGBKInavdOK15jsl",1731705121000)).toBe(false);
    expect(await verifyResendSignature(body,headers,"whsec_plJ3nmyCDGBKInavdOK15jsl",1731705500000)).toBe(false);
  });
  it("validates mailbox ownership and uses provider authentication, never email headers",async()=>{
    const email={id:"4ef9a417-02e9-4d39-ad75-9611e0fcc33c",from:"Vendor <dispatch@example.test>",to:["maintenance@example.test"],subject:"CPS-2026-0104",text:"Tuesday morning",html:null,attachments:[],authentication:{dmarc:"fail"},headers:{"authentication-results":"dmarc=pass"}};
    const fetcher=vi.fn(async()=>Response.json(email));
    expect(await readResendEmail(email.id,"test-key","maintenance@example.test",fetcher)).toMatchObject({sender:"dispatch@example.test",senderVerified:false,body:"Tuesday morning"});
    await expect(readResendEmail(email.id,"test-key","different@example.test",fetcher)).rejects.toThrow("outside");
  });
  it("routes a verified vendor reply using the company's configured work-order prefix",async()=>{
    const fixture=buildNorthlinePresentationFixture();const repository=createOpsFixtureRepository(fixture);
    const org=fixture.organizations[0].id;
    const assigned=fixture.assignments.find(row=>row.organizationId===org&&row.vendorId&&row.status==="accepted")!;
    const active=await repository.getActiveAssignment(org,assigned.workOrderId);
    expect(active?.vendorId).toBeTruthy();
    const vendor=fixture.vendors.find(row=>row.id===active?.vendorId)!;const work=fixture.workOrders.find(row=>row.id===assigned.workOrderId)!;
    const email=await receiveEmail({repository},{organizationId:org,messageKey:"reply-prefix",sender:vendor.dispatchEmail,subject:`Re: ${work.number}`,body:"The technician will arrive Tuesday morning."});
    expect((await routeVerifiedEmail({repository},email.id,org,true))?.workOrderId).toBe(work.id);
    const ambiguous=await receiveEmail({repository},{organizationId:org,messageKey:"ambiguous",sender:vendor.dispatchEmail,subject:`${work.number} and ${fixture.workOrders.find(row=>row.id!==work.id)!.number}`,body:"Please review."});
    expect((await routeVerifiedEmail({repository},ambiguous.id,org,true))?.status).toBe("needs_review");
  });
});
