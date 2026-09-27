import Link from "next/link";
import styles from "./compliance.module.css";
export function StoreWorkspaceNav({id,active="overview"}:{id:string;active?:"overview"|"compliance"|"vendors"}) {
  return <nav className={styles.filters} aria-label="Store pages">{(["overview","compliance","vendors"] as const).map(tab=><Link key={tab} aria-current={tab===active?"page":undefined} href={`/app/stores/${encodeURIComponent(id)}${tab==="overview"?"":`/${tab}`}`}>{tab==="overview"?"Store overview":tab==="compliance"?"Compliance":"Vendors"}</Link>)}</nav>;
}
