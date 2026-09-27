import Link from "next/link";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository, getServerOpsReportingAsOf } from "@/lib/server/ops-repository-provider";
import { loadWorkCostPrompts } from "@/lib/ops/work-cost-prompts";
import styles from "./communications.module.css";
export async function WorkCostPrompts({workOrderId}:{workOrderId:string}) {
  const session = await loadOperatorSession();
  if (!["facilities","regional","executive","finance"].includes(session.role) || session.demoEdition === "accountability") return null;
  const rows = await loadWorkCostPrompts(await getServerOpsRepository(),session,workOrderId,await getServerOpsReportingAsOf());
  if (!rows.length) return null;
  return <section className={styles.prompts} aria-label="Before the next repair"><h2>Before the next repair</h2>{rows.map(row => <div key={row.id} className={styles.prompt}><div><strong>{row.title}</strong><p>{row.detail}</p></div><Link href={row.href}>{row.action} →</Link></div>)}</section>;
}
