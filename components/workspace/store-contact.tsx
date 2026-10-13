import { MapPin, Phone, UserRound } from "lucide-react";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import type { OpsRepository } from "@/lib/ops/repository";
import type { Store } from "@/lib/ops/types";
import styles from "./store-contact.module.css";

/** Digits and a leading plus, so the number dials on every phone. */
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/gu, "")}`;
}

export function directionsHref(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * Who to call and how to get there: store phone, store manager, directions and how to get in.
 * The caller has already checked that the viewer can open this store.
 */
export async function StoreContact({ repository, store, accessNotes = true }: { repository: OpsRepository; store: Store; accessNotes?: boolean }) {
  const managers = (await repository.listNotificationRecipients(store.organizationId, "store_manager", { storeId: store.id, regionId: store.regionId }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.membershipId.localeCompare(b.membershipId))
    .slice(0, 2);
  const address = [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", ");
  return (
    <section className={styles.contact} aria-label="Store contact">
      <div className={styles.actions}>
        {store.phone ? (
          <a className={styles.action} href={telHref(store.phone)}>
            <Phone aria-hidden="true" size={18} />
            <span><strong>Call store</strong><small>{store.phone}</small></span>
          </a>
        ) : null}
        {managers.map((manager) => (
          <a className={styles.action} href={manager.phone ? telHref(manager.phone) : `mailto:${manager.email}`} key={manager.membershipId}>
            <UserRound aria-hidden="true" size={18} />
            <span><strong>{manager.displayName}</strong><small>Store manager · {manager.phone ?? "Email"}</small></span>
          </a>
        ))}
        <a className={styles.action} href={directionsHref(address)} target="_blank" rel="noreferrer">
          <MapPin aria-hidden="true" size={18} />
          <span><strong>Directions</strong><small>{store.address1}, {store.city}</small></span>
        </a>
      </div>
      {accessNotes && store.accessNotes ? <p className={styles.notes}><strong>How to get in</strong>{store.accessNotes}</p> : null}
    </section>
  );
}

/** The store contact for a work order the viewer can open. */
export async function WorkStoreContact({ workOrderId }: { workOrderId: string }) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const work = await repository.getWorkOrderDetail(session, workOrderId);
  const store = work ? await repository.getStore(session.organizationId, work.storeId) : null;
  return store ? <StoreContact repository={repository} store={store} /> : null;
}
