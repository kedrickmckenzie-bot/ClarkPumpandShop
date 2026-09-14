import Link from "next/link";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { isFictionalPreview, trustsSitesIdentity } from "@/lib/server/operator-access";
import { productPresentation } from "@/lib/product/presentation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function WorkspaceAccess({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const preview = isFictionalPreview();
  const configured = trustsSitesIdentity();
  const signIn = reason === "sign_in";
  return <main className={styles.canvas}><section className={styles.panel}>
    <p className={styles.brand}>{productPresentation.identity.workingName}</p>
    <h1>{preview ? "Preview workspace" : !configured ? "Workspace setup needed" : signIn ? "Sign in to continue" : reason === "membership" ? "Access needed" : "Choose your company"}</h1>
    <p>{preview ? "Open the fictional demo workspace." : !configured ? "Ask your administrator to finish setting up sign-in." : signIn ? "Use the account your company invited." : reason === "membership" ? "Your account cannot open this company. Check the company code or ask your administrator." : "Enter the company code from your invitation."}</p>
    {preview ? <Link className={styles.button} href="/app/overview">Open preview</Link> : configured && signIn ? <a className={styles.button} href={chatGPTSignInPath("/app/overview")} target="_top">Sign in</a> : configured ?
      <form action="/api/ops/organization" method="post"><label htmlFor="company-code">Company code</label><input id="company-code" name="organizationId" required maxLength={120} autoComplete="off" /><button className={styles.button} type="submit">Continue</button></form> : null}
  </section></main>;
}
