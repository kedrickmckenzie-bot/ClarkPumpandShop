import { z } from "zod";
import type { PublicUpload } from "@/components/ops-public/contracts";

const base64Bytes = (value:string) => Uint8Array.from(atob(value),char=>char.charCodeAt(0));
export async function verifyResendSignature(body:string,headers:Headers,secret:string,now=Date.now()) {
  try {
    const id=headers.get("svix-id");const stamp=headers.get("svix-timestamp") ?? "";
    if(!id || !/^\d+$/.test(stamp) || Math.abs(now-Number(stamp)*1000)>300000 || !secret.startsWith("whsec_"))return false;
    const key=await crypto.subtle.importKey("raw",base64Bytes(secret.slice(6)),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    for(const value of (headers.get("svix-signature") ?? "").split(" ")) {
      if(value.startsWith("v1,") && await crypto.subtle.verify("HMAC",key,base64Bytes(value.slice(3)),new TextEncoder().encode(`${id}.${stamp}.${body}`)))return true;
    }
  } catch { return false; }
  return false;
}

const attachmentSchema=z.object({id:z.string().uuid(),filename:z.string().nullable(),size:z.number().int().nonnegative(),content_type:z.string()});
const emailSchema=z.object({id:z.string().uuid(),from:z.string(),to:z.array(z.string()),subject:z.string().max(300),text:z.string().nullable(),html:z.string().nullable(),authentication:z.object({dmarc:z.string()}).nullable().optional(),attachments:z.array(attachmentSchema).max(5)});

export async function readResendEmail(emailId:string,apiKey:string,mailbox:string,fetcher:typeof fetch=fetch) {
  if(!z.string().uuid().safeParse(emailId).success)throw new Error("Invalid received email identifier");
  const get=async(path:string)=>{const response=await fetcher(`https://api.resend.com${path}`,{headers:{authorization:`Bearer ${apiKey}`},redirect:"error",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Email provider retrieval failed (${response.status})`);return response.json();};
  const email=emailSchema.parse(await get(`/emails/receiving/${emailId}?html_format=cid`));
  if(!email.to.some(to=>to.toLowerCase()===mailbox.toLowerCase()))throw new Error("Received email is outside this configured mailbox");
  const sender=email.from.match(/<([^<>]+)>/)?.[1] ?? email.from;
  const body=email.text?.trim() || email.html?.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"").replace(/<br\s*\/?\s*>|<\/p>/gi,"\n").replace(/<[^>]*>/g,"").replaceAll("&nbsp;"," ").replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&").trim() || "(Email has no text body)";
  if(body.length>30000 || email.attachments.reduce((sum,file)=>sum+file.size,0)>8*1024*1024)throw new Error("Email exceeds the intake limit");
  const uploads:PublicUpload[]=[];
  for(const file of email.attachments) {
    if(!["application/pdf","image/png","image/jpeg","image/webp","text/plain"].includes(file.content_type))throw new Error("Email contains an unsupported attachment type");
    const detail=z.object({download_url:z.string().url()}).parse(await get(`/emails/receiving/${emailId}/attachments/${file.id}`));
    const url=new URL(detail.download_url);
    if(url.protocol!=="https:" || url.hostname!=="inbound-cdn.resend.com" || url.port || url.username || url.password)throw new Error("Unexpected email attachment host");
    const response=await fetcher(url,{redirect:"error",signal:AbortSignal.timeout(15000)});
    if(!response.ok || Number(response.headers.get("content-length") ?? 0)>8*1024*1024)throw new Error("Email attachment could not be retrieved");
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==file.size)throw new Error("Email attachment size does not match its source");
    uploads.push({name:(file.filename ?? "attachment").slice(0,180),mediaType:file.content_type,size:bytes.byteLength,bytes});
  }
  return {messageKey:`resend:${email.id}`,sender,subject:email.subject,body,uploads,senderVerified:email.authentication?.dmarc==="pass"};
}
