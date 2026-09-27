import { z } from "zod";
import { verifyEmailSignature, storeEmailFiles } from "@/lib/server/email-intake-ingress";
import { receiveEmail, routeVerifiedEmail } from "@/lib/ops/email-intake";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { opsApiError } from "@/lib/server/ops-request-context";

const envelope = z.object({messageKey:z.string().min(1).max(300),sender:z.string().email().max(254),subject:z.string().max(300),body:z.string().min(1).max(30000),reportedDate:z.string().max(300).optional(),senderVerified:z.boolean().default(false),attachments:z.array(z.object({name:z.string().min(1).max(180),mediaType:z.enum(["application/pdf","image/png","image/jpeg","image/webp","text/plain"]),base64:z.string().max(11200000)})).max(5).default([])});

/** A mailbox adapter signs normalized evidence. Tenant comes from configuration, never the email. */
export async function POST(request: Request) {
  try {
    const secret = process.env.OPS_EMAIL_INGRESS_SECRET ?? "";
    const org = process.env.OPS_EMAIL_INGRESS_ORGANIZATION_ID;
    if (!org || secret.length < 32) return new Response("Email intake is not configured",{status:503});
    if (Number(request.headers.get("content-length") ?? 0) > 12000000) return new Response("Email too large",{status:413});
    const body = await request.text();
    if (body.length > 12000000) return new Response("Email too large",{status:413});
    if (!await verifyEmailSignature(body,request.headers.get("x-email-timestamp") ?? "",request.headers.get("x-email-signature") ?? "",secret)) return new Response("Invalid email signature",{status:401});
    const parsed = envelope.safeParse(JSON.parse(body));
    if (!parsed.success) return new Response("Invalid email envelope",{status:422});
    const data = parsed.data;
    const uploads = data.attachments.map(file => { const decoded = Uint8Array.from(atob(file.base64),char => char.charCodeAt(0)); return {name:file.name,mediaType:file.mediaType,size:decoded.byteLength,bytes:decoded.buffer}; });
    const repository = await getServerOpsRepository();
    const files = await storeEmailFiles(org,data.messageKey,uploads,false);
    const email = await receiveEmail({repository},{...data,organizationId:org,files});
    const result = await routeVerifiedEmail({repository},email.id,org,data.senderVerified);
    return Response.json({id:result?.id,status:result?.status});
  } catch (error) { return opsApiError(error); }
}
