import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import styles from "./communications.module.css";
export async function RoutineFollowUpSettings() {
  const session = await loadOperatorSession();
  if (session.role !== "facilities" || session.storeIds !== undefined || session.regionIds !== undefined) return null;
  const repository = await getServerOpsRepository();
  const policy = await repository.getFollowUpPreference(session.organizationId);
  return <section className={`${styles.workspace} ${styles.panel} ${styles.compact}`}>
    <div><h2>Routine follow-ups</h2><p>Remind the person responsible, check missed visits, and ask the store if a repair worked.</p></div>
    <form className={styles.routing} action="/api/ops/routine-follow-ups" method="post"><label>Frequency<select name="cadenceHours" defaultValue={policy?.cadenceHours ?? 0}><option value="0">Off</option><option value="24">Once a day</option><option value="48">Every two days</option><option value="168">Once a week</option></select></label><button type="submit">Save follow-ups</button></form>
    <small>Starts when an action is due. Unanswered work escalates after two intervals. Updates stop queued reminders.</small>
    {session.accessMode === "preview" && policy?.cadenceHours ? <form action="/api/ops/routine-follow-ups" method="post"><input type="hidden" name="action" value="preview"/><button type="submit">Queue a preview cycle</button><p>No email is sent by this preview action.</p></form> : null}
  </section>;
}
