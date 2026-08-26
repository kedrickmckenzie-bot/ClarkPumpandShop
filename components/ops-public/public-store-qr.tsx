"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { QrCode } from "lucide-react";
import QRCode from "qrcode";
import styles from "./public-workflows.module.css";

function safeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function PublicStoreQr({
  configuredOrigin,
  storeNumber,
  targetPath,
}: {
  configuredOrigin?: string;
  storeNumber: string;
  targetPath: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const origin = safeOrigin(configuredOrigin);
  const publicUrl = useMemo(() => origin ? new URL(targetPath, `${origin}/`).toString() : "", [origin, targetPath]);
  const localOnly = publicUrl ? ["localhost", "127.0.0.1"].includes(new URL(publicUrl).hostname) : false;

  useEffect(() => {
    if (!publicUrl) return;
    let cancelled = false;
    void QRCode.toDataURL(publicUrl, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#132f31", light: "#ffffff" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => { cancelled = true; };
  }, [publicUrl]);

  return (
    <section className={styles.portalQr} aria-labelledby="public-store-qr-title">
      <div className={styles.portalQrCopy}>
        <span className={styles.portalQrIcon}><QrCode aria-hidden="true" size={22} /></span>
        <div><span className={styles.eyebrow}>Use a technician&apos;s phone</span><h2 id="public-store-qr-title">Scan to open Store {storeNumber} check-in</h2><p>The permanent store code opens this same page. After check-in, the secure checkout stays available on that device.</p></div>
      </div>
      <div className={styles.portalQrImage}>
        {qrDataUrl ? <Image alt={`Store ${storeNumber} vendor check-in QR code`} height={190} priority src={qrDataUrl} unoptimized width={190} /> : <span>Generating QR…</span>}
      </div>
      {localOnly ? <p className={styles.portalQrNotice}>A phone cannot open localhost. Use the deployed site to scan this from another device.</p> : null}
    </section>
  );
}
