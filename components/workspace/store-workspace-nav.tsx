import Link from "next/link";
import styles from "./compliance.module.css";
export function StoreWorkspaceNav({id,active="overview"}:{id:string;active?:"tasks"|"overview"|"compliance"|"vendors"|"warranties"}) {
  return <nav className={styles.filters} aria-label="Store pages">{(["overview","tasks","compliance","warranties","vendors"] as const).map(tab=><Link key={tab} aria-current={tab===active?"page":undefined} href={`/app/stores/${encodeURIComponent(id)}${tab==="overview"?"":`/${tab}`}`}>{tab==="overview"?"Store overview":tab==="tasks"?"Tasks":tab==="compliance"?"Compliance":tab==="warranties"?"Warranties":"Vendors"}</Link>)}</nav>;
}
