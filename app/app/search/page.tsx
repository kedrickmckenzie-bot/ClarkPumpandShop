import Link from "next/link";
import { loadOperatorSession } from "../_data/operator-loader";
import { technicianSearch } from "@/lib/server/technician-search";
import styles from "@/components/workspace/internal-dispatch.module.css";
import type { Metadata } from "next";
import { SearchView } from "@/components/ops/views";
import { loadSearchModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Search" };
type Query = Record<string, string | string[] | undefined>;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query=await searchParams,session=await loadOperatorSession();
  if(session.role!=="technician")return <SearchView model={await loadSearchModel(query)}/>;
  const q=(Array.isArray(query.q)?query.q[0]:query.q)??"",results=await technicianSearch(q);
  return <div className={styles.workspace}><header className={styles.jobHeader}><h1>Search</h1><form method="get" className={styles.search}><label>Store, equipment or work<input name="q" type="search" defaultValue={q} maxLength={160}/></label><button type="submit">Search</button></form></header>
    {!q?<p>Search for a store, equipment name or problem.</p>:results.groups.every(group=>!group.rows.length)?<p>No matches. Try a store number or a shorter problem.</p>:results.groups.filter(group=>group.rows.length).map(group=><section className={styles.jobBody} key={group.id}><h2 className={styles.subHeading}>{group.label}</h2><ul className={styles.historyList}>{group.rows.map(row=><li key={row.id}><Link href={row.href}>{row.label}</Link><p>{row.detail}</p></li>)}</ul>{group.nextCursor?<p>Showing the first 25 matches. Add a store number or a more specific phrase.</p>:null}</section>)}
  </div>;
}
