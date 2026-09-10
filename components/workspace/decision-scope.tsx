"use client";
import { useRouter } from "next/navigation";
import type { DecisionContextModel } from "@/app/app/_data/decision-context";
import styles from "./lifecycle-record-stack.module.css";

export function DecisionScope({ choices }: { choices: DecisionContextModel["choices"] }) {
  const router = useRouter();
  const selected = choices.find((row) => row.selected) ?? choices[0];
  const params = new URL(selected.href, "https://local.test").searchParams;
  return <form action="/app/lifecycle#decision-context" method="get" className={styles.mobileScope}>
    {[...params.entries()].filter(([key]) => !["component", "historyPage", "costPage"].includes(key)).map(([key,value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <label>Review equipment or component<select name="component" value={params.get("component") ?? ""} onChange={(event) => { const choice = choices.find((row) => (new URL(row.href, "https://local.test").searchParams.get("component") ?? "") === event.target.value); if (choice) router.push(choice.href); }}>{choices.map((choice) => <option key={choice.href} value={new URL(choice.href, "https://local.test").searchParams.get("component") ?? ""}>{choice.label}</option>)}</select></label>
    <noscript><button type="submit">Review scope</button></noscript>
  </form>;
}
