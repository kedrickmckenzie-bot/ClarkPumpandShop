import Link from "next/link";
import { storeWorkspaceContext } from "@/lib/server/store-workspace-context";
import { StoreWorkspaceNav } from "@/components/workspace/store-workspace-nav";
import { WarrantyCenter, type WarrantySearch } from "@/components/workspace/warranty-center";
import styles from "@/components/workspace/warranty-center.module.css";
export const metadata={title:"Store warranties"};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<WarrantySearch>}) {const {id}=await params,{store,session}=await storeWorkspaceContext(id);return <div className={styles.page}><header className={styles.header}><div><Link href="/app/stores">Stores</Link><h1>Store {store.storeNumber} · Warranties</h1><p>{store.name} · {store.address1}, {store.city}</p></div>{["executive","facilities","regional"].includes(session.role)?<Link className={styles.button} href={`/app/warranties/new?store=${encodeURIComponent(id)}`}>Add warranty</Link>:null}</header><StoreWorkspaceNav id={id} active="warranties"/><WarrantyCenter searchParams={searchParams} fixedStore={id}/></div>;}
