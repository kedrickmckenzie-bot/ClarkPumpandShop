import Link from "next/link";
import { ArrowRight, ClipboardPlus, MapPin, UserRoundCheck } from "lucide-react";
import type { StorePortalView } from "./contracts";
import { PublicFrame } from "./public-ui";
import styles from "./public-workflows.module.css";

export function StorePortalHome({ token, portal }: { token: string; portal: StorePortalView }) {
  const base = `/public/store/${encodeURIComponent(token)}`;
  return (
    <PublicFrame organizationName={portal.organizationName} context={`Store ${portal.store.number} · Service desk`} mode={portal.mode}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Store {portal.store.number}</span>
          <h1 className={styles.title}>How can we help?</h1>
          <p className={styles.lede}><MapPin aria-hidden="true" size={18} /> {portal.store.name} · {portal.store.address}</p>
        </div>
      </div>
      <div className={styles.portalChoices}>
        {portal.capabilities.reportIssue ? (
          <Link className={styles.portalChoice} href={`${base}/report`}>
            <span className={styles.portalChoiceIcon}><ClipboardPlus aria-hidden="true" size={24} /></span>
            <div><h2>Report a store problem</h2><p>Employees can document an issue for manager review. Equipment selection is optional.</p></div>
            <span className={styles.portalChoiceCta}>Report an issue <ArrowRight aria-hidden="true" size={17} /></span>
          </Link>
        ) : null}
        {portal.capabilities.startVisit || portal.capabilities.finishVisit ? (
          <Link className={styles.portalChoice} href={`${base}/visit`}>
            <span className={styles.portalChoiceIcon}><UserRoundCheck aria-hidden="true" size={24} /></span>
            <div>
              <h2>{portal.capabilities.startVisit && portal.capabilities.finishVisit ? "Vendor check-in or checkout" : portal.capabilities.startVisit ? "Vendor check-in" : "Finish vendor visit"}</h2>
              <p>{portal.trustedStoreDevice ? "Start a visit or select an onsite technician to finish one—no account, PIN, or location permission required." : "Technicians can connect to assigned work or use a visit-bound checkout receipt without an account."}</p>
            </div>
            <span className={styles.portalChoiceCta}>Open vendor visit <ArrowRight aria-hidden="true" size={17} /></span>
          </Link>
        ) : null}
      </div>
      <section className={styles.notice} style={{ marginTop: "1rem" }}>
        <strong>Simple by design</strong>
        <p className={styles.helper}>{portal.trustedStoreDevice ? "This trusted store computer uses the server receipt time, so a busy employee cannot backdate the visit later." : "This page does not require a login or PIN. Each action receives a server-confirmed record."}</p>
      </section>
    </PublicFrame>
  );
}
