import { getOpsRequestContext,assertStoreInSessionScope,opsApiError } from "@/lib/server/ops-request-context";
export async function GET(request:Request) {try{
 const {session,repository:r}=await getOpsRequestContext(["facilities","regional"],undefined,request),query=new URL(request.url).searchParams,store=query.get("store")??"",search=(query.get("q")??"").slice(0,160);
 await assertStoreInSessionScope(session,store);
 const [people,vendors]=await Promise.all([r.listComplianceOwners(session.organizationId,search),r.listVendors({...session,storeIds:[store]},search,{limit:20})]);
 const allowed=await Promise.all(people.map(async person=>(await r.listStoreIdsForMembership(session.organizationId,person.id)).includes(store)?{...person,kind:"internal"}:null));
 const covered=await Promise.all(vendors.items.map(async vendor=>(await r.vendorCoversStore(session.organizationId,vendor.id,store))?vendor:null));
 return Response.json({items:[...allowed.filter(Boolean),...covered.filter((v):v is NonNullable<typeof v>=>v!==null&&v.status==="approved").map(v=>({id:v.id,name:v.name,kind:"vendor"}))]},{headers:{"cache-control":"no-store"}});
 }catch(error){return opsApiError(error);}}
