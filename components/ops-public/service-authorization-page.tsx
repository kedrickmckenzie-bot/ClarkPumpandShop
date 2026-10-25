import { OptionalVisitWork } from "./optional-visit-work";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, MapPin, Phone } from "lucide-react";
import type { ServiceAuthorizationView } from "./contracts";
import { formatPublicDateTime, PublicFrame } from "./public-ui";
import { oneLine } from "@/lib/product/one-line";
import { VendorResponseForm } from "./vendor-response-form";
import styles from "./public-workflows.module.css";

export type ServiceJobContext = NonNullable<Awaited<ReturnType<typeof import("./server-gateway").resolveServiceJobContext>>>;

export function ServiceAuthorizationPage({ token, authorization, forms=[], job }: { token: string; authorization: ServiceAuthorizationView;forms?:Array<{name:string;href:string}>; job?: ServiceJobContext }) {
  const zone = authorization.store.timeZone;
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: zone ?? undefined });
  const hasFinalResponse = authorization.serviceDecisionsClosed || authorization.status === "accepted" || authorization.status === "declined";
  return (
    <PublicFrame organizationName={authorization.organizationName} context="Work order" mode={authorization.mode}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Assigned to {authorization.vendorName}</span>
          <h1 className={styles.title}>{oneLine(authorization.service.problem)}</h1>
          <p className={styles.lede}>Store {authorization.store.number} · {authorization.store.name} · Work order {authorization.operatorWorkOrderNumber}</p>
        </div>
        <span className={styles.priority}>{authorization.priority}</span>
      </div>

      {job?.onSite.length && authorization.technicianVisitUrl ? <section className={styles.checkoutNextStep}>
        <div><span className={styles.eyebrow}>On site now</span><h2>{job.onSite.map(visit => visit.technicianName).join(", ")} checked in {formatPublicDateTime(job.onSite[0].checkedInAt, zone)}</h2><p>When the work is done, check out here.</p></div>
        <Link className={styles.button} href={authorization.technicianVisitUrl}>Check out <ArrowRight aria-hidden="true" size={17} /></Link>
      </section> : null}

      <div className={styles.layout}>
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="service-request-title">
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.eyebrow}>Job details</span>
                <h2 className={styles.cardTitle} id="service-request-title">The job</h2>
              </div>
            </div>

            {oneLine(authorization.service.problem) !== authorization.service.problem ? <p className={styles.serviceText}>{authorization.service.problem}</p> : null}
            {job ? <p className={styles.helper}>Reported {formatPublicDateTime(job.reportedAt, zone)}{job.reportedBy ? ` by ${job.reportedBy}` : ""}</p> : null}
            <div className={styles.requestedWork}>
              <h2 className={styles.cardTitle}>What we need you to do</h2>
              <p className={styles.serviceText}>{authorization.service.requestedWork}</p>
            </div>
            {authorization.service.serviceNote ? <div className={styles.requestedWork}><h2 className={styles.cardTitle}>Notes from {authorization.organizationName}</h2><p className={styles.serviceText}>{authorization.service.serviceNote}</p></div> : null}
            <div className={styles.detailGrid} style={{ marginTop: "1.2rem" }}>
              {authorization.service.category ? <div className={styles.detail}><span className={styles.detailLabel}>Service type</span><p className={styles.detailValue}>{authorization.service.category}</p></div> : null}
              {job?.equipment ? null : <div className={styles.detail}><span className={styles.detailLabel}>Equipment</span><p className={styles.detailValue}>{authorization.service.asset ?? "See the job description"}</p></div>}
              <div className={styles.detail}><span className={styles.detailLabel}>Issued</span><p className={styles.detailValue}>{formatPublicDateTime(authorization.issuedAt, authorization.store.timeZone)}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Response due</span><p className={styles.detailValue}>{authorization.responseDueAt ? formatPublicDateTime(authorization.responseDueAt, authorization.store.timeZone) : "No response deadline stated"}</p></div>
            </div>
            <div className={styles.callout} style={{ marginTop: "1rem" }}><strong>Your next step</strong><p>{authorization.nextStep}</p></div>
          </section>

          {job?.equipment ? <section className={styles.card} aria-labelledby="service-equipment-title">
            <h2 className={styles.cardTitle} id="service-equipment-title">Equipment</h2>
            <p className={styles.serviceText}><strong>{job.equipment.name}</strong> · {job.equipment.tag}</p>
            {job.equipment.make || job.equipment.serial ? <p className={styles.helper}>{[job.equipment.make, job.equipment.serial ? `Serial ${job.equipment.serial}` : undefined].filter(Boolean).join(" · ")}</p> : null}
            {job.equipment.installedAt ? <p className={styles.helper}>Installed {day(job.equipment.installedAt)}</p> : null}
            {job.equipment.warranty ? <div className={styles.callout} style={{ marginTop: ".8rem" }}><strong>Under warranty</strong><p>With {job.equipment.warranty.provider} until {day(`${job.equipment.warranty.end.slice(0, 10)}T12:00:00Z`)}. Check before replacing covered parts.</p></div> : null}
            {job.history.length ? <div style={{ marginTop: "1rem" }}>
              <h3 className={styles.detailLabel}>Your earlier work on this unit</h3>
              <ul className={styles.stack} style={{ listStyle: "none", padding: 0, margin: ".4rem 0 0" }}>{job.history.map(item => <li key={item.id}>
                <strong>{day(item.date)}</strong> · {item.number} · {item.problem}{item.did ? <p className={styles.helper}>{item.did}</p> : null}
              </li>)}</ul>
            </div> : null}
          </section> : null}

          {job?.photos.length ? <section className={styles.card} aria-labelledby="service-photos-title">
            <h2 className={styles.cardTitle} id="service-photos-title">Photos</h2>
            <ul style={{ display: "flex", flexWrap: "wrap", gap: ".6rem", listStyle: "none", padding: 0, margin: ".6rem 0 0" }}>{job.photos.map(photo => <li key={photo.id}>
              <a href={`/api/ops-public/service/${encodeURIComponent(token)}/photos/${encodeURIComponent(photo.id)}`} target="_blank" rel="noreferrer"><img src={`/api/ops-public/service/${encodeURIComponent(token)}/photos/${encodeURIComponent(photo.id)}`} alt={photo.name} loading="lazy" style={{ display: "block", width: 140, height: 105, objectFit: "cover", borderRadius: 4, border: "1px solid #d9e0e8" }}/></a>
            </li>)}</ul>
          </section> : null}

          {forms.length?<section className={styles.card}><h2 className={styles.cardTitle}>Instructions & blank forms</h2><p>Download or print, then return the completed paperwork and photos.</p><ul>{forms.map(f=><li key={f.href}><a target="_blank" rel="noopener noreferrer" href={f.href}>{f.name}</a> · <a href={`${f.href}?download=1`}>Download</a></li>)}</ul></section>:null}
          {authorization.priorResponse ? (
            <section className={styles.notice} aria-label="Recorded vendor response">
              <strong>{authorization.priorResponse.label}</strong>
              <p className={styles.helper}>Received {formatPublicDateTime(authorization.priorResponse.receivedAt, authorization.store.timeZone)}{authorization.priorResponse.detail ? ` · ${authorization.priorResponse.detail}` : ""}</p>
            </section>
          ) : null}
          {authorization.operatorContinuation ? (
            <section className={styles.notice} aria-label="Operator follow-up">
              <strong>{authorization.operatorContinuation.label}</strong>
              <p className={styles.helper}>Recorded {formatPublicDateTime(authorization.operatorContinuation.receivedAt, authorization.store.timeZone)}{authorization.operatorContinuation.detail ? ` · ${authorization.operatorContinuation.detail}` : ""}</p>
            </section>
          ) : null}
          <VendorResponseForm disabled={hasFinalResponse} opened={authorization.opened} organizationName={authorization.organizationName} token={token} />
          {/* Before a response, saved jobs are offered inside "Accept work". Afterwards they stay available here. */}
          {hasFinalResponse ? <OptionalVisitWork token={token} /> : null}
        </div>

        <aside className={styles.stack} aria-label="Service authorization details">
          <section className={styles.card}>
            <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Where to go</h2><Building2 aria-hidden="true" color="#315dcc" size={22} /></div>
            <div className={styles.stack}>
              <div className={styles.detail}><span className={styles.detailLabel}>Location</span><p className={styles.detailValue}><MapPin aria-hidden="true" size={16} /> {authorization.store.address}</p><a className={styles.textLink} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(authorization.store.address)}`} target="_blank" rel="noreferrer">Directions <ArrowRight aria-hidden="true" size={16} /></a></div>
              {authorization.store.phone ? <div className={styles.detail}><span className={styles.detailLabel}>Store phone</span><p className={styles.detailValue}><a href={`tel:${authorization.store.phone.replace(/[^\d+]/gu, "")}`}><Phone aria-hidden="true" size={16} /> {authorization.store.phone}</a></p></div> : null}
              {authorization.service.accessNotes ? <div className={styles.detail}><span className={styles.detailLabel}>How to get in</span><p className={styles.detailValue}>{authorization.service.accessNotes}</p></div> : null}
            </div>
          </section>

          {authorization.appointment ? (
            <section className={styles.card}>
              <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Visit timing</h2><CalendarDays aria-hidden="true" color="#315dcc" size={22} /></div>
              <div className={styles.detail} style={{ marginTop: ".8rem" }}><span className={styles.detailLabel}>{authorization.appointment.status === "confirmed" ? "Confirmed appointment" : authorization.appointment.status === "counter_proposed" ? "Operator counterproposal" : "Proposed appointment"}</span><p className={styles.detailValue}>{formatPublicDateTime(authorization.appointment.startsAt, authorization.store.timeZone)}</p>{authorization.appointment.note ? <p className={styles.helper}>{authorization.appointment.note}</p> : null}</div>
              <p className={styles.muted} style={{ marginTop: ".65rem" }}>{authorization.appointment.status === "confirmed" ? "This is the agreed service timing." : "This time remains a proposal until both sides confirm it."}</p>
            </section>
          ) : null}

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>When you invoice</h2>
            <div className={styles.stack} style={{ marginTop: "1rem" }}>
              <div className={styles.detail}><span className={styles.detailLabel}>Include this work-order number</span><p className={styles.detailValue}>{authorization.authorization.billingInstruction}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Work-order version</span><p className={styles.detailValue}>{authorization.revision}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Issued by</span><p className={styles.detailValue}>{authorization.authorization.requestedBy}</p></div>
            </div>
          </section>

          {authorization.technicianVisitUrl ? (
            <section className={styles.card}>
              <CalendarDays aria-hidden="true" color="#315dcc" size={24} />
              <h2 className={styles.cardTitle} style={{ marginTop: "0.65rem" }}>Technician check-in and checkout</h2>
              <p className={styles.muted} style={{ marginTop: "0.35rem" }}>Start or finish your visit from any phone. No account needed.</p>
              <Link className={styles.textLink} href={authorization.technicianVisitUrl} style={{ marginTop: "0.85rem" }}>Open technician check-in / checkout <ArrowRight aria-hidden="true" size={16} /></Link>
            </section>
          ) : null}

          <section className={styles.notice}>
            <strong>Need help?</strong>
            <p className={styles.helper}>{authorization.organizationSupport}</p>
          </section>
        </aside>
      </div>
    </PublicFrame>
  );
}
