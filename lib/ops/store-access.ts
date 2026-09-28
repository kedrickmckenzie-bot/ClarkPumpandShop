import { OpsDomainError, type OpsCommandServices } from "./commands";
import { communicationAudit, insertRecord } from "./email-intake";
import type { ActorContext } from "./types";

/** Issue a purpose-bound store capability. Plaintext is returned once, never persisted. */
export async function createStoreAccess(svc: OpsCommandServices, input: { organizationId: string; storeId: string; actor: ActorContext }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "Organization access required");
  const store = await svc.repository.getStore(input.organizationId, input.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store not found");
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))), b=>b.toString(16).padStart(2,"0")).join("");
  const now = svc.clock?.now() ?? new Date().toISOString();
  const expiresAt = new Date(Date.parse(now) + 365 * 86400000).toISOString();
  await svc.repository.atomicWrite([
    insertRecord("ops_public_tokens", { id: `store-access-${crypto.randomUUID()}`, organization_id: input.organizationId, purpose: "store_gateway", subject_type: "store", subject_id: store.id, token_hash: hash, expires_at: expiresAt, created_at: now }),
    communicationAudit(input.organizationId, store.id, "store.access_link_created", input.actor, now, { expiresAt }, "store"),
  ]);
  return { publicPath: `/public/store/${raw}`, expiresAt };
}
