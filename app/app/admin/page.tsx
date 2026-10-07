import type { Metadata } from "next";
import { ListView } from "@/components/ops/views";
import { JobHealthSection } from "@/components/workspace/job-health";
import { isFictionalPreview } from "@/lib/server/operator-access";
import { loadJobHealthModel, loadListModel, loadOperatorSession } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Administration" };
type Query = Record<string, string | string[] | undefined>;

export default async function AdministrationPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { demoReset, ...query } = await searchParams;
  const [model, health, session] = await Promise.all([loadListModel("admin", query), loadJobHealthModel(), loadOperatorSession()]);
  const canResetDemo = isFictionalPreview() && session.role === "facilities" && !session.persona;
  const resetAt = typeof demoReset === "string" && !Number.isNaN(Date.parse(demoReset)) ? demoReset : undefined;
  return (
    <>
      {resetAt ? <p role="status" style={{ margin: "0 0 16px", padding: "12px 16px", background: "#ecfdf3", border: "1px solid #abefc6", borderRadius: 6 }}>Demo reset · fresh as of {new Date(resetAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p> : null}
      <ListView model={model} />
      {canResetDemo ? (
        <details style={{ marginTop: 24 }}>
          <summary style={{ cursor: "pointer", padding: 16, fontWeight: 600 }}>Reset demo data</summary>
          <form method="post" action="/api/ops/demo/reset" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", padding: "0 16px 16px" }}>
            <p style={{ flexBasis: "100%", margin: 0 }}>Erases every change in this demo and reloads the fictional stores, dated from today.</p>
            <label style={{ display: "grid", gap: 4 }}>Type RESET to confirm<input name="confirm" required pattern="[Rr][Ee][Ss][Ee][Tt]" autoComplete="off" style={{ padding: 8, fontSize: 16 }} /></label>
            <button type="submit" style={{ padding: "9px 16px", fontSize: 15, background: "#b42318", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" }}>Reset demo data</button>
          </form>
        </details>
      ) : null}
      {health ? <details style={{ marginTop: 24 }}><summary style={{ cursor: "pointer", padding: 16, fontWeight: 600 }}>Admin diagnostics</summary><JobHealthSection model={health} /></details> : null}
    </>
  );
}
