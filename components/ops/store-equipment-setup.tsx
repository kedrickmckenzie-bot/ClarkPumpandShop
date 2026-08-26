"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  PackageCheck,
  Plus,
  Search,
  Store,
} from "lucide-react";
import styles from "@/components/workspace/equipment-commissioning.module.css";

export interface StoreEquipmentSetupViewModel {
  storeId: string;
  storeLabel: string;
  addressLabel: string;
  action: string;
  backHref: string;
  groups: Array<{
    id: string;
    name: string;
    pathLabel: string;
    templates: Array<{
      id: string;
      name: string;
      expectedLifeLabel: string;
      componentLabel: string;
      alreadyAtStore: number;
    }>;
  }>;
}

export interface StoreEquipmentNamingViewModel {
  storeId: string;
  storeLabel: string;
  addressLabel: string;
  action: string;
  backHref: string;
  equipment: Array<{
    id: string;
    assetTag: string;
    currentName: string;
    equipmentType: string;
    categoryLabel: string;
    componentCount: number;
  }>;
}

function SetupProgress({ active }: { active: 2 | 3 }) {
  return (
    <ol className={styles.progress} aria-label="Store setup progress">
      <li data-state="complete"><span><Check size={14} aria-hidden="true" /></span><div><strong>Store</strong><small>Details saved</small></div></li>
      <li data-state={active === 2 ? "active" : "complete"}><span>{active === 2 ? "2" : <Check size={14} aria-hidden="true" />}</span><div><strong>Equipment</strong><small>Select quantities</small></div></li>
      <li data-state={active === 3 ? "active" : "upcoming"}><span>3</span><div><strong>Name & finish</strong><small>Identify locations</small></div></li>
    </ol>
  );
}

function CommissioningHeader({
  storeLabel,
  addressLabel,
  backHref,
  title,
  description,
}: {
  storeLabel: string;
  addressLabel: string;
  backHref: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <Link className={styles.backLink} href={backHref}><ArrowLeft size={15} aria-hidden="true" />Back to store</Link>
      <header className={styles.header}>
        <div>
          <p>Store setup</p>
          <h1>{title}</h1>
          <span>{description}</span>
        </div>
        <aside><Store size={20} aria-hidden="true" /><span><strong>{storeLabel}</strong><small>{addressLabel}</small></span></aside>
      </header>
    </>
  );
}

export function StoreEquipmentSetup({ model }: { model: StoreEquipmentSetupViewModel }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const total = useMemo(() => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0), [quantities]);
  const groups = model.groups
    .map((group) => ({
      ...group,
      templates: group.templates.filter((template) => !normalizedQuery || `${group.pathLabel} ${group.name} ${template.name}`.toLocaleLowerCase("en-US").includes(normalizedQuery)),
    }))
    .filter((group) => group.templates.length > 0);

  function setQuantity(id: string, next: number) {
    const value = Math.max(0, Math.min(50, Number.isFinite(next) ? Math.round(next) : 0));
    setQuantities((current) => ({ ...current, [id]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!total) {
      setError("Choose at least one equipment type before continuing.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(model.action, {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
        headers: { "x-ops-client": "store-equipment-setup" },
      });
      const body = await response.json().catch(() => null) as { error?: string; redirectTo?: string } | null;
      if (!response.ok) {
        setPending(false);
        setError(body?.error ?? "The store equipment could not be created.");
        return;
      }
      window.location.assign(body?.redirectTo ?? model.backHref);
    } catch {
      setPending(false);
      setError("The store equipment could not be created. Check your connection and try again.");
    }
  }

  return (
    <main className={styles.workspace}>
      <CommissioningHeader
        storeLabel={model.storeLabel}
        addressLabel={model.addressLabel}
        backHref={model.backHref}
        title="Select the equipment this store has"
        description="Choose a quantity. Standard components are created automatically and details can be added later."
      />
      <SetupProgress active={2} />
      <section className={styles.callout}>
        <PackageCheck size={21} aria-hidden="true" />
        <div><strong>Fast by design</strong><p>You only need the equipment type and quantity today. Model, serial, warranty, and vendor-supplied details remain optional.</p></div>
      </section>
      <form action={model.action} method="post" onSubmit={submit} className={styles.form}>
        <div className={styles.toolbar}>
          <label><Search size={17} aria-hidden="true" /><span className={styles.visuallyHidden}>Search equipment types</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search coolers, HVAC, dispensers…" /></label>
          <span><strong>{total}</strong> equipment item{total === 1 ? "" : "s"} selected</span>
        </div>
        <div className={styles.groupList}>
          {groups.map((group) => (
            <section className={styles.group} key={group.id}>
              <header><div><small>{group.pathLabel || "Equipment library"}</small><h2>{group.name}</h2></div><span>{group.templates.length} type{group.templates.length === 1 ? "" : "s"}</span></header>
              <div className={styles.templateRows}>
                {group.templates.map((template) => {
                  const quantity = quantities[template.id] ?? 0;
                  return (
                    <div className={styles.templateRow} data-selected={quantity > 0 || undefined} key={template.id}>
                      <div><strong>{template.name}</strong><p>{template.componentLabel}<span aria-hidden="true"> · </span>{template.expectedLifeLabel}</p>{template.alreadyAtStore ? <small>{template.alreadyAtStore} already at this store</small> : null}</div>
                      <div className={styles.stepper} aria-label={`${template.name} quantity`}>
                        <button type="button" onClick={() => setQuantity(template.id, quantity - 1)} disabled={quantity === 0} aria-label={`Remove one ${template.name}`}><Minus size={16} aria-hidden="true" /></button>
                        <input name={`quantity:${template.id}`} type="number" min="0" max="50" value={quantity} onChange={(event) => setQuantity(template.id, Number(event.target.value))} aria-label={`${template.name} quantity`} />
                        <button type="button" onClick={() => setQuantity(template.id, quantity + 1)} disabled={quantity === 50} aria-label={`Add one ${template.name}`}><Plus size={16} aria-hidden="true" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {!groups.length ? <div className={styles.empty}><Search size={22} aria-hidden="true" /><strong>No equipment types match “{query}”</strong><button type="button" onClick={() => setQuery("")}>Clear search</button></div> : null}
        </div>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <footer className={styles.stickyFooter}>
          <div><strong>{total || "No"} equipment item{total === 1 ? "" : "s"} selected</strong><span>Next, give repeated units a plain name or location.</span></div>
          <div><Link className={styles.secondaryButton} href={model.backHref}>Skip for now</Link><button className={styles.primaryButton} disabled={pending || total === 0} type="submit">{pending ? "Creating equipment…" : "Continue to names"}<ArrowRight size={17} aria-hidden="true" /></button></div>
        </footer>
      </form>
    </main>
  );
}

export function StoreEquipmentNaming({ model }: { model: StoreEquipmentNamingViewModel }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(model.action, {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
        headers: { "x-ops-client": "store-equipment-naming" },
      });
      const body = await response.json().catch(() => null) as { error?: string; redirectTo?: string } | null;
      if (!response.ok) {
        setPending(false);
        setError(body?.error ?? "The equipment names could not be saved.");
        return;
      }
      window.location.assign(body?.redirectTo ?? model.backHref);
    } catch {
      setPending(false);
      setError("The equipment names could not be saved. Check your connection and try again.");
    }
  }

  return (
    <main className={styles.workspace}>
      <CommissioningHeader
        storeLabel={model.storeLabel}
        addressLabel={model.addressLabel}
        backHref={model.backHref}
        title="Name each unit so anyone can find it"
        description="Use the location people say out loud—such as Checkout wall, Beer cave, or Rooftop unit 2."
      />
      <SetupProgress active={3} />
      <section className={styles.callout}>
        <PackageCheck size={21} aria-hidden="true" />
        <div><strong>The technical details can wait</strong><p>Stable equipment tags and standard components are already created. Vendors can add model, serial, and part information during service.</p></div>
      </section>
      <form action={model.action} method="post" onSubmit={submit} className={styles.form}>
        <section className={styles.namingPanel}>
          <header><div><p>New equipment</p><h2>{model.equipment.length} record{model.equipment.length === 1 ? "" : "s"} ready to name</h2></div><span>All names are required</span></header>
          <div className={styles.namingRows}>
            {model.equipment.map((asset, index) => (
              <div className={styles.namingRow} key={asset.id}>
                <span className={styles.rowNumber}>{index + 1}</span>
                <div className={styles.assetIdentity}><strong>{asset.equipmentType}</strong><span>{asset.categoryLabel}<span aria-hidden="true"> · </span>{asset.assetTag}<span aria-hidden="true"> · </span>{asset.componentCount} standard component{asset.componentCount === 1 ? "" : "s"}</span></div>
                <label htmlFor={`asset-name-${asset.id}`}><span>Name or location</span><input id={`asset-name-${asset.id}`} name={`name:${asset.id}`} required maxLength={180} defaultValue={asset.currentName} placeholder="Example: Checkout wall" autoComplete="off" /></label>
              </div>
            ))}
          </div>
        </section>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <footer className={styles.stickyFooter}>
          <div><strong>Names are editable later</strong><span>Saving now makes issue reporting and service history immediately clear.</span></div>
          <div><Link className={styles.secondaryButton} href={model.backHref}>Keep automatic names</Link><button className={styles.primaryButton} disabled={pending} type="submit">{pending ? "Saving names…" : "Save & finish store setup"}<ArrowRight size={17} aria-hidden="true" /></button></div>
        </footer>
      </form>
    </main>
  );
}
