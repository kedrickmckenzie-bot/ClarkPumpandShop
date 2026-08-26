"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import QRCode from "qrcode";
import styles from "./store-qr-material.module.css";

function normalizedOrigin(configuredOrigin: string | undefined): string | null {
  if (!configuredOrigin) return null;
  try {
    const url = new URL(configuredOrigin);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function StoreQrMaterial({
  storeNumber,
  storeName,
  targetPath,
  configuredOrigin,
}: {
  storeNumber: string;
  storeName: string;
  targetPath: string;
  configuredOrigin?: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const origin = normalizedOrigin(configuredOrigin);
  const publicUrl = useMemo(() => origin ? new URL(targetPath, `${origin}/`).toString() : "", [origin, targetPath]);
  const localOnly = publicUrl ? ["localhost", "127.0.0.1"].includes(new URL(publicUrl).hostname) : false;

  useEffect(() => {
    if (!publicUrl) return;
    let cancelled = false;
    void QRCode.toDataURL(publicUrl, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#172033", light: "#ffffff" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => { cancelled = true; };
  }, [publicUrl]);

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className={styles.material} aria-labelledby="store-vendor-qr-title">
      <header className={styles.header}>
        <div className={styles.icon}><QrCode aria-hidden="true" size={22} /></div>
        <div>
          <span>Vendor access</span>
          <h2 id="store-vendor-qr-title">Store {storeNumber} check-in QR code</h2>
          <p>Post this code at the service counter or back-room entry. It opens the store&apos;s account-free vendor check-in.</p>
        </div>
      </header>
      <div className={styles.content}>
        <div className={styles.qrFrame}>
          {qrDataUrl ? (
            <Image
              alt={`QR code for vendor check-in at Store ${storeNumber}, ${storeName}`}
              height={272}
              priority
              src={qrDataUrl}
              unoptimized
              width={272}
            />
          ) : <div className={styles.qrLoading}>Generating QR code…</div>}
          <strong>STORE {storeNumber}</strong>
          <span>Vendor check-in / checkout</span>
        </div>
        <div className={styles.instructions}>
          <div>
            <span className={styles.step}>1</span>
            <p><strong>Scan and choose the work.</strong> The technician selects the operator work order or records that no work order was provided.</p>
          </div>
          <div>
            <span className={styles.step}>2</span>
            <p><strong>Check in with server time.</strong> Location is requested only for the arrival event when policy enables it.</p>
          </div>
          <div>
            <span className={styles.step}>3</span>
            <p><strong>Finish the same visit.</strong> The secure checkout stays available on that device, and rescanning this code brings the technician back to it.</p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href={targetPath} target="_blank">Open live page <ExternalLink aria-hidden="true" size={16} /></Link>
            <button className={styles.secondaryAction} disabled={!publicUrl} onClick={copyLink} type="button">{copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}{copied ? "Copied" : "Copy link"}</button>
            {qrDataUrl ? <a className={styles.secondaryAction} download={`store-${storeNumber}-vendor-qr.png`} href={qrDataUrl}><Download aria-hidden="true" size={16} />Download QR</a> : null}
          </div>
          {localOnly ? <p className={styles.localNotice}><strong>Local preview:</strong> a phone cannot open your computer&apos;s localhost address. The same QR automatically uses the public site URL after deployment.</p> : null}
          {publicUrl ? <p className={styles.url}>{publicUrl}</p> : null}
        </div>
      </div>
    </section>
  );
}
