"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./work-prices.module.css";
export function WorkPricePlanForm({workOrderId,priceId,signature}: {workOrderId:string;priceId:string;signature:string}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(""); const router=useRouter();
  return <form className={styles.planActions} onSubmit={async event=>{
    event.preventDefault();if(busy)return;setBusy(true);setError("");
    try {const data=new FormData();data.set("signature",signature);
      const response=await fetch(`/api/ops/work-orders/${workOrderId}/prices/${priceId}/plan`,{method:"POST",body:data});
      const result=await response.json() as {error?:string};
      if(!response.ok){setError(result.error??"Could not update plans.");return;}
      router.push(`/app/work-orders/${workOrderId}?notice=Plans+updated&view=overview#work-prices`);router.refresh();
    }catch{setError("Could not update plans. Try again.");}finally{setBusy(false);}
  }}><button disabled={busy}>{busy?"Updating…":"Update plans"}</button>{error?<p role="alert">{error}</p>:null}</form>;
}
