import { z } from "zod";
import { readResendEmail,verifyResendSignature } from "@/lib/server/resend-email-intake";
import { storeEmailFiles } from "@/lib/server/email-intake-ingress";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { receiveEmail,routeVerifiedEmail } from "@/lib/ops/email-intake";

export async function POST(request:Request) {
  const secret=process.env.OPS_RESEND_RECEIVING_SECRET;
  const org=process.env.OPS_EMAIL_INGRESS_ORGANIZATION_ID;
  const mailbox=process.env.OPS_EMAIL_INBOX_ADDRESS;
  const key=process.env.EMAIL_API_KEY;
  if(!secret || !org || !mailbox || !key)return new Response("Email intake is not configured",{status:503});
  const body=await request.text();
  if(body.length>100000)return new Response("Webhook too large",{status:413});
  if(!await verifyResendSignature(body,request.headers,secret))return new Response("Invalid email signature",{status:401});
  try {
    const event=z.object({type:z.string(),data:z.object({email_id:z.string().uuid()})}).parse(JSON.parse(body));
    if(event.type!=="email.received")return Response.json({ignored:true});
    const incoming=await readResendEmail(event.data.email_id,key,mailbox);
    const repository=await getServerOpsRepository();
    const files=await storeEmailFiles(org,incoming.messageKey,incoming.uploads,false);
    const email=await receiveEmail({repository},{...incoming,organizationId:org,files});
    const result=await routeVerifiedEmail({repository},email.id,org,incoming.senderVerified);
    return Response.json({id:result?.id,status:result?.status});
  } catch {
    // Provider retries keep retrieval/storage failures observable without logging email contents or signed URLs.
    return new Response("Email intake failed; check mailbox delivery attempts and retry.",{status:503});
  }
}
