import Link from "next/link";
import {storeWorkspaceContext} from "@/lib/server/store-workspace-context";
import {StoreWorkspaceNav} from "@/components/workspace/store-workspace-nav";
import ComplianceWorkspace from "@/components/workspace/compliance-workspace";
import styles from "@/components/workspace/compliance.module.css";
export default async function StoreCompliance({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{view?:string;offset?:string;notice?:string;error?:string}>}) {
  const {id}=await params,{store}=await storeWorkspaceContext(id);
  return <div className={styles.page}><header><Link href="/app/stores">Stores</Link><h1>Store {store.storeNumber} · Compliance</h1><p>{store.name}</p><small>{store.address1}, {store.city}, {store.state} {store.postalCode}</small></header>
    <StoreWorkspaceNav id={id} active="compliance"/>
    <ComplianceWorkspace searchParams={searchParams} fixedStore={id}/>
  </div>;
}
