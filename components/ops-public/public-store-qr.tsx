"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useBrowserOrigin } from "@/components/use-browser-origin";
import { selectPublicQrOrigin } from "@/lib/ops/public-origin";
import styles from "./public-workflows.module.css";

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
  const runtimeOrigin = useBrowserOrigin();
  const origin = selectPublicQrOrigin(configuredOrigin, runtimeOrigin);
  const publicUrl = useMemo(() => origin ? new URL(targetPath, `${origin}/`).toString() : "", [origin, targetPath]);

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
    </section>
  );
}
