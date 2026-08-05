"use client";

import { CheckCircle2, ExternalLink, Mail, QrCode as QrIcon, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, PageHeader, PanelTitle, StatusBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/domain/analytics";
import { demoData, STORE_QR_TOKEN, STORY_WORK_ORDER_ID, VENDOR_ACCEPT_TOKEN } from "@/lib/demo/data";

export function EmailOutbox() {
  const [sent, setSent] = useState(false);
  const [qr, setQr] = useState("");
  const workOrder = demoData.workOrders.find((item) => item.id === STORY_WORK_ORDER_ID)!;
  const store = demoData.stores.find((item) => item.id === workOrder.storeId)!;
  const vendor = demoData.vendors.find((item) => item.id === workOrder.vendorId)!;
  useEffect(() => { void QRCode.toDataURL(`${window.location.origin}/technician/${STORE_QR_TOKEN}`, { width: 240, margin: 2, color: { dark: "#102b2c", light: "#ffffff" } }).then(setQr); }, []);
  return <AppShell><div className="page"><Breadcrumbs items={[{ label: "Operations", href: "/" }, { label: "Email outbox" }]} /><PageHeader eyebrow="Demo communication" title="Vendor work-order email" description="The email is an auditable outbound artifact. Vendor response updates Clark’s record without recreating a dispatch platform." />
    <div className="split-grid"><section className="panel panel-pad"><PanelTitle title="Ready to send" description={`To ${vendor.dispatchEmail}`} /><div className="record-card" style={{ padding: 18 }}><div className="record-line"><Mail size={15} /><strong>Service request: {workOrder.number} · {store.name}</strong><StatusBadge tone={sent ? "good" : "pending"}>{sent ? "sent in demo" : "draft"}</StatusBadge></div><p className="description">NorthStar Dispatch, Clark’s requests service for <strong>{workOrder.title}</strong> at {store.name}, {store.city}, {store.state}.</p><div className="record-meta"><div className="meta-item"><span>Priority</span><strong>Critical</strong></div><div className="meta-item"><span>Requested</span><strong>May 18, 2026</strong></div><div className="meta-item"><span>Not to exceed</span><strong>{formatCurrency(workOrder.nteCents)}</strong></div><div className="meta-item"><span>Clark’s owner</span><strong>{workOrder.accountableParty}</strong></div></div><div className="callout" style={{ marginTop: 15 }}><strong>Requested response</strong><p>Accept, decline, or request clarification. Continue technician assignment and dispatch in your own system.</p><Link className="button primary small" style={{ marginTop: 10 }} href={`/vendor/accept/${VENDOR_ACCEPT_TOKEN}`}>Open secure response <ExternalLink /></Link></div></div><button className="button primary" style={{ marginTop: 14 }} onClick={() => setSent(true)}>{sent ? <CheckCircle2 /> : <Send />}{sent ? "Email added to audit trail" : "Send demo email"}</button></section>
      <section className="panel panel-pad"><PanelTitle title="Store technician QR" description="Reusable store link; technician selects the relevant work order after opening." />{qr ? <Image unoptimized src={qr} width={210} height={210} alt={`QR code for technician check-in at ${store.name}`} style={{ display: "block", margin: "6px auto 12px", border: "1px solid #dce2de", borderRadius: 12 }} /> : <div className="empty-state">Generating QR…</div>}<div className="callout"><strong><QrIcon size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Minimal field flow</strong><p>Open link → select work → verify location → record outcome. No technician roster, parts inventory or route assignment.</p></div><Link className="button" style={{ marginTop: 12, width: "100%" }} href={`/technician/${STORE_QR_TOKEN}`}>Open technician flow</Link></section></div>
  </div></AppShell>;
}
