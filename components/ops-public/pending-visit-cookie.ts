import { cookies } from "next/headers";
import type { StorePortalView } from "./contracts";
import { getPublicOperationsGateway } from "./server-gateway";

export const PENDING_VISIT_COOKIE = "ops_pending_visit";

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,240}$/;

export interface PendingVisitCheckout {
  checkoutUrl: string;
  technicianName: string;
  vendorName: string;
  checkedInAt: string;
  workOrderLabels: string[];
}

export function checkoutTokenFromUrl(checkoutUrl: string): string | null {
  const match = /^\/public\/store\/([A-Za-z0-9_-]{20,240})\/visit$/.exec(checkoutUrl);
  return match?.[1] ?? null;
}

export function setPendingVisitCookie(
  response: Response,
  requestUrl: string,
  checkoutUrl: string,
  expiresAt: string,
): void {
  const token = checkoutTokenFromUrl(checkoutUrl);
  if (!token) return;
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  const expires = new Date(expiresAt);
  response.headers.append(
    "set-cookie",
    `${PENDING_VISIT_COOKIE}=${encodeURIComponent(token)}; Path=/public/store; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`,
  );
}

export function clearPendingVisitCookie(response: Response, requestUrl: string): void {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  response.headers.append(
    "set-cookie",
    `${PENDING_VISIT_COOKIE}=; Path=/public/store; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export async function loadPendingVisitCheckout(portal: StorePortalView, storeToken?: string): Promise<PendingVisitCheckout | null> {
  const rawToken = (await cookies()).get(PENDING_VISIT_COOKIE)?.value;
  if (!rawToken || !OPAQUE_TOKEN_PATTERN.test(rawToken)) return null;

  try {
    const gateway = getPublicOperationsGateway();
    const [pendingPortal, context] = await Promise.all([
      gateway.loadStorePortal(rawToken),
      gateway.lookupVendorVisitContext(rawToken),
    ]);
    const activeVisit = context.activeVisits[0];
    if (
      !pendingPortal
      || !pendingPortal.capabilities.finishVisit
      || pendingPortal.organizationName !== portal.organizationName
      || pendingPortal.store.number !== portal.store.number
      || !activeVisit
    ) return null;

    return {
      checkoutUrl: `/public/store/${encodeURIComponent(rawToken)}/visit${storeToken ? `?returnTo=${encodeURIComponent(`/public/store/${storeToken}`)}` : ""}`,
      technicianName: activeVisit.technicianName,
      vendorName: activeVisit.vendorName,
      checkedInAt: activeVisit.checkedInAt,
      workOrderLabels: activeVisit.workOrders.map((workOrder) => workOrder.number),
    };
  } catch {
    return null;
  }
}
