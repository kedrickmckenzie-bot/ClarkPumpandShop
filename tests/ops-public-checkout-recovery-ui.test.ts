import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StoreQrMaterial } from "@/components/ops/store-qr-material";
import type { StorePortalView } from "@/components/ops-public/contracts";
import {
  checkoutTokenFromUrl,
  clearPendingVisitCookie,
  setPendingVisitCookie,
  type PendingVisitCheckout,
} from "@/components/ops-public/pending-visit-cookie";
import { StorePortalHome } from "@/components/ops-public/store-portal-home";
import { StoreReportForm } from "@/components/ops-public/store-report-form";
import { TechnicianVisitFlow } from "@/components/ops-public/technician-visit-flow";

const checkoutToken = "checkoutCapabilityToken_1234567890";

const portal: StorePortalView = {
  organizationName: "Clark Pump and Shop",
  trustedStoreDevice: false,
  store: { number: "104", name: "Northline Market", address: "104 Main Street" },
  vendors: [],
  locationPolicy: { enabled: true, explanation: "Event-only location" },
  capabilities: { reportIssue: true, startVisit: true, finishVisit: false },
  visitChannel: "qr",
  mode: "demo",
};

const pendingVisit: PendingVisitCheckout = {
  checkoutUrl: `/public/store/${checkoutToken}/visit`,
  technicianName: "Taylor Morgan",
  vendorName: "ColdLine Refrigeration & HVAC",
  checkedInAt: "2026-08-26T14:00:00.000Z",
  workOrderLabels: ["CPS-2026-0116"],
};

describe("public visit checkout recovery and store QR", () => {
  it("sets an HttpOnly same-site recovery cookie from a visit checkout capability", () => {
    const response = Response.json({ ok: true });
    setPendingVisitCookie(
      response,
      "https://operations.example/api/ops-public/store/store-token/check-in",
      pendingVisit.checkoutUrl,
      "2026-08-27T14:00:00.000Z",
    );

    expect(checkoutTokenFromUrl(pendingVisit.checkoutUrl)).toBe(checkoutToken);
    expect(response.headers.get("set-cookie")).toContain(`ops_pending_visit=${checkoutToken}`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("clears the recovery cookie after successful checkout", () => {
    const response = Response.json({ ok: true });
    clearPendingVisitCookie(response, "http://localhost:3000/api/ops-public/store/token/check-out");
    expect(response.headers.get("set-cookie")).toContain("ops_pending_visit=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("makes the recovered checkout the first action on the reusable store portal", () => {
    const markup = renderToStaticMarkup(createElement(StorePortalHome, {
      token: "storeEntryToken_1234567890123456",
      portal,
      pendingVisit,
      publicOrigin: "https://operations.example",
    }));

    expect(markup).toContain("Visit currently onsite");
    expect(markup).toContain("Ready to check out Taylor Morgan?");
    expect(markup).toContain("Finish this visit");
    expect(markup).toContain(pendingVisit.checkoutUrl);
    expect(markup).toContain("Scan to open Store 104 check-in");
  });

  it("renders downloadable store QR material in the operator record", () => {
    const markup = renderToStaticMarkup(createElement(StoreQrMaterial, {
      storeNumber: "104",
      storeName: "Northline Market",
      targetPath: "/public/store/storeEntryToken_1234567890123456",
      configuredOrigin: "https://operations.example",
    }));

    expect(markup).toContain("Store 104 check-in QR code");
    expect(markup).toContain("Generating QR code");
    expect(markup).toContain("Finish the same visit");
    expect(markup).toContain("Open live page");
    expect(markup).toContain("Copy link");
  });

  it("keeps store options reachable from both public sub-workflows", () => {
    const storeToken = "storeEntryToken_1234567890123456";
    const storeHref = `/public/store/${storeToken}`;
    const reportMarkup = renderToStaticMarkup(createElement(StoreReportForm, { token: storeToken, portal }));
    const visitMarkup = renderToStaticMarkup(createElement(TechnicianVisitFlow, {
      token: storeToken,
      portal,
      pendingVisit: null,
      storeOptionsHref: storeHref,
    }));

    expect(reportMarkup).toContain("Back to store options");
    expect(reportMarkup).toContain(`href="${storeHref}"`);
    expect(visitMarkup).toContain("Back to store options");
    expect(visitMarkup).toContain(`href="${storeHref}"`);
  });
});
