/**
 * Stable, product-name-neutral identifiers shared by operator UI requests and
 * server route handlers. The legacy header remains readable during rolling
 * deployments, but all new browser requests use the neutral header.
 */
export const OPS_CLIENT_HEADER = "x-ops-client";
const LEGACY_OPS_CLIENT_HEADER = "x-traceops-client";

export function isOpsClientRequest(request: Request, clientId: string): boolean {
  return request.headers.get(OPS_CLIENT_HEADER) === clientId
    || request.headers.get(LEGACY_OPS_CLIENT_HEADER) === clientId;
}
