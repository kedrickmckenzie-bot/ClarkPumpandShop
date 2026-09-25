import { describe, expect, it, vi } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
const mocks = vi.hoisted(() => ({ context: vi.fn(), repo: vi.fn() }));
vi.mock("@/lib/server/ops-request-context", async () => ({ ...await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context"), getOpsRequestContext: mocks.context }));
vi.mock("@/lib/server/ops-repository-provider", () => ({getServerOpsRepository: mocks.repo}));
type Payload = {rows:{id:string;revision:number;eligible:boolean}[];results:{ok:boolean;message:string}[]};
async function payload(response: Response) { return await response.json() as Payload; }
import { GET } from "@/app/api/ops/saved-work/route";
function setup() {
  const f = buildNorthlinePresentationFixture();
  const vendor = f.vendors.find(v=>v.name.startsWith("BrightLine"))!;
  for (const doc of f.vendorComplianceDocuments.filter(d=>d.vendorId===vendor.id)) doc.expiresAt="2030-01-01T00:00:00Z";
  const repository = createOpsFixtureRepository(f);
  const session = {organizationId:NORTHLINE_ORGANIZATION_ID,organizationName:f.organizations[0].name,role:"facilities",membershipId:"membership-northline-facilities",displayName:"Jordan Lee"};
  mocks.context.mockResolvedValue({repository,session,actor:{organizationId:session.organizationId,actorType:"user",actorId:session.membershipId,actorName:session.displayName}});
  mocks.repo.mockResolvedValue(repository);
  return {repository,session,url:`https://ops.test/api/ops/saved-work?storeId=store-northline-104&vendorId=${vendor.id}`};
}
describe("saved work suggestions",()=>{
  it("matches service category at this store and enforces location scope",async()=>{
    const t=setup(); const response=await GET(new Request(t.url)); const data=await payload(response);
    expect(response.status).toBe(200); expect(data.rows.some((r:{id:string})=>r.id==="wo-held-104-canopy-light")).toBe(true);
    expect(data.rows.find((r:{id:string})=>r.id==="wo-held-104-restroom-door")!.eligible).toBe(false);
    const context=await mocks.context(); context.session.storeIds=["store-northline-105"];
    expect((await GET(new Request(t.url))).status).toBe(403);
  });
});
