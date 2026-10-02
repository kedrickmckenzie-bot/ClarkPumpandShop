"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { formatOperationsDate } from "@/lib/ops/local-time";
import styles from "@/components/workspace/work-warranty-context.module.css";
type Matches={count:number;items:Array<{id:string;provider:string;end:string;component?:string}>};
export function WorkWarrantyHint({assetId,componentId}:{assetId:string;componentId?:string}) {
  const selection = `${assetId}:${componentId??""}`;
  const [result,setResult]=useState<{asset:string;count:number;items:Array<{id:string;provider:string;end:string;component?:string}>}|null>(null);
  const [failed,setFailed]=useState("");
  useEffect(()=>{
    if(!assetId)return;
    const controller=new AbortController();
    fetch(`/api/ops/warranties/matches?${new URLSearchParams({asset:assetId,...(componentId?{component:componentId}:{})})}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();return await response.json() as Matches;}).then(data=>setResult({...data,asset:selection})).catch(()=>{if(!controller.signal.aborted)setFailed(selection);});
    return ()=>controller.abort();
  },[assetId,componentId,selection]);
  if(!assetId)return null;
  if(result?.asset!==selection)return failed===selection?<p>Warranty check unavailable. Review equipment coverage before sending.</p>:<p role="status">Checking warranty…</p>;
  if(!result.count)return null;
  return <aside className={styles.banner}><strong>May be covered by warranty</strong><p>Check coverage before agreeing to charges.</p><ul>{result.items.map(c=><li key={c.id}><Link href={`/app/warranties/coverage/${encodeURIComponent(c.id)}`} target="_blank">{c.provider} · {c.component??"Whole equipment"} · ends {formatOperationsDate(c.end)}</Link></li>)}</ul></aside>;
}
