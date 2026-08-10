"use client";

import { type FormEvent, useId, useState } from "react";
import {
  Building2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Info,
  Truck,
  Users,
} from "lucide-react";

import styles from "./cstore-workflows.module.css";
import type {
  EquipmentComponentOption,
  EquipmentOption,
  InternalTeamOption,
  StoreOption,
  VendorOption,
  WorkFulfillmentMode,
  WorkOrderCreationValue,
  WorkPriority,
} from "./types";
import { VendorPicker } from "./vendor-picker";

export interface WorkOrderCreationProps {
  stores: StoreOption[];
  equipmentOptions?: EquipmentOption[];
  componentOptions?: EquipmentComponentOption[];
  internalTeams: InternalTeamOption[];
  vendors: VendorOption[];
  onCreate: (value: WorkOrderCreationValue) => void | Promise<void>;
  initialValue?: Partial<WorkOrderCreationValue>;
  className?: string;
  isSubmitting?: boolean;
}

const priorityOptions: Array<{ value: WorkPriority; label: string }> = [
  { value: "routine", label: "Routine" },
  { value: "soon", label: "Needs attention" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
];

const handlerOptions: Array<{
  value: WorkFulfillmentMode;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    value: "internal",
    label: "Internal team",
    description: "Send it to an employee, maintenance team, or shared internal queue.",
    icon: Users,
  },
  {
    value: "external",
    label: "Outside vendor",
    description: "Choose an approved vendor and prepare a service authorization.",
    icon: Truck,
  },
  {
    value: "decide_later",
    label: "Decide later",
    description: "Create the record now and assign responsibility when the right person reviews it.",
    icon: Clock3,
  },
];

export function WorkOrderCreation({
  stores,
  equipmentOptions = [],
  componentOptions = [],
  internalTeams,
  vendors,
  onCreate,
  initialValue,
  className,
  isSubmitting: submittingFromParent = false,
}: WorkOrderCreationProps) {
  const formId = useId();
  const [storeId, setStoreId] = useState(initialValue?.storeId ?? "");
  const [storeQuery, setStoreQuery] = useState("");
  const [assetId, setAssetId] = useState(initialValue?.assetId ?? "");
  const [componentId, setComponentId] = useState(initialValue?.componentId ?? "");
  const [problem, setProblem] = useState(initialValue?.problem ?? "");
  const [priority, setPriority] = useState<WorkPriority>(
    initialValue?.priority ?? "soon",
  );
  const [fulfillmentMode, setFulfillmentMode] = useState<WorkFulfillmentMode>(
    initialValue?.fulfillmentMode ?? "internal",
  );
  const [internalTeamId, setInternalTeamId] = useState(
    initialValue?.internalTeamId ?? "",
  );
  const [vendorId, setVendorId] = useState(initialValue?.vendorId ?? "");
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = submittingFromParent || localSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!storeId) {
      setError("Choose the store where the work is needed.");
      return;
    }

    if (problem.trim().length < 8) {
      setError("Describe the problem in enough detail for someone to act on it.");
      return;
    }

    if (fulfillmentMode === "external" && !vendorId) {
      setError("Choose an outside vendor, or select “Decide later.”");
      return;
    }

    const value: WorkOrderCreationValue = {
      storeId,
      problem: problem.trim(),
      priority,
      fulfillmentMode,
      ...(assetId ? { assetId } : {}),
      ...(assetId && componentId ? { componentId } : {}),
      ...(fulfillmentMode === "internal" && internalTeamId ? { internalTeamId } : {}),
      ...(fulfillmentMode === "external" && vendorId ? { vendorId } : {}),
    };

    try {
      setLocalSubmitting(true);
      await onCreate(value);
    } catch {
      setError("The work order could not be created. Nothing was sent; please try again.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  const submitLabel =
    fulfillmentMode === "external"
      ? "Create & review authorization"
      : fulfillmentMode === "internal"
        ? "Create internal work order"
        : "Create & assign later";
  const normalizedStoreQuery = storeQuery.trim().toLowerCase();
  const filteredStores = stores.filter((store) =>
    !normalizedStoreQuery ||
    [store.storeNumber, store.name, store.address, store.regionName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedStoreQuery),
  );
  const storeEquipment = equipmentOptions.filter((item) => item.storeId === storeId);
  const equipmentComponents = componentOptions.filter((item) => item.assetId === assetId);

  return (
    <form
      className={[styles.root, styles.surface, className].filter(Boolean).join(" ")}
      onSubmit={handleSubmit}
      noValidate
    >
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>Work orders</span>
          <h2>Create a work order</h2>
          <p>
            Capture what the store needs first. Equipment details can be added later without
            delaying legitimate work.
          </p>
        </div>
        <span className={styles.stepPill}>
          <Building2 aria-hidden="true" />
          Store → responsibility
        </span>
      </header>

      <div className={styles.body}>
        <section className={styles.section} aria-labelledby={`${formId}-need-heading`}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>1</span>
            <div>
              <h3 id={`${formId}-need-heading`}>Where is the problem, and what happened?</h3>
              <p>Use plain language. The person reporting it does not need to diagnose it.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor={`${formId}-store`}>Store</label>
              <input
                id={`${formId}-store-search`}
                className={styles.input}
                type="search"
                value={storeQuery}
                onChange={(event) => setStoreQuery(event.target.value)}
                placeholder="Search store number, name, city, or address"
                aria-label="Search stores"
              />
              <select
                id={`${formId}-store`}
                className={styles.select}
                value={storeId}
                onChange={(event) => {
                  const nextStoreId = event.target.value;
                  setStoreId(nextStoreId);

                  if (
                    assetId &&
                    !equipmentOptions.some(
                      (item) => item.id === assetId && item.storeId === nextStoreId,
                    )
                  ) {
                    setAssetId("");
                    setComponentId("");
                  }
                }}
                required
              >
                <option value="">Choose a store</option>
                {filteredStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    #{store.storeNumber} · {store.name} — {store.address}
                  </option>
                ))}
              </select>
              <span className={styles.fieldHint}>
                Store number and address remain attached to the work order.
              </span>
            </div>

            <div className={styles.field}>
              <label htmlFor={`${formId}-problem`}>What needs attention?</label>
              <textarea
                id={`${formId}-problem`}
                className={styles.textarea}
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                placeholder="Example: The beer cave is warm and the temperature display reads 48°F. No unusual noise noticed."
                minLength={8}
                required
              />
              <span className={styles.fieldHint}>
                Include what people can see, hear, smell, or measure. Classification remains optional.
              </span>
            </div>
          </div>

          <div className={styles.equipmentGrid}>
            <div className={styles.field}>
              <label htmlFor={`${formId}-equipment`}>Equipment, if known</label>
              <select
                id={`${formId}-equipment`}
                className={styles.select}
                value={assetId}
                onChange={(event) => {
                  const nextAssetId = event.target.value;
                  setAssetId(nextAssetId);

                  if (
                    componentId &&
                    !componentOptions.some(
                      (item) => item.id === componentId && item.assetId === nextAssetId,
                    )
                  ) {
                    setComponentId("");
                  }
                }}
                disabled={!storeId}
              >
                <option value="">
                  {storeId ? "Not known / choose later" : "Choose a store first"}
                </option>
                {storeEquipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.assetCode} · {item.name}
                    {item.locationDetail ? ` — ${item.locationDetail}` : ""}
                  </option>
                ))}
              </select>
              <span className={styles.fieldHint}>
                Leave this blank when the exact equipment has not been identified.
              </span>
            </div>

            <div className={styles.field}>
              <label htmlFor={`${formId}-component`}>Component, if known</label>
              <select
                id={`${formId}-component`}
                className={styles.select}
                value={componentId}
                onChange={(event) => setComponentId(event.target.value)}
                disabled={!assetId}
              >
                <option value="">
                  {assetId ? "No component / choose later" : "Choose equipment first (optional)"}
                </option>
                {equipmentComponents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.componentCode} · {item.name}
                  </option>
                ))}
              </select>
              <span className={styles.fieldHint}>
                Components add repair-history detail but never block the work order.
              </span>
            </div>
          </div>

          <fieldset className={styles.handlerFieldset}>
            <legend className={styles.fieldLabel}>Priority</legend>
            <div className={styles.priorityRow}>
              {priorityOptions.map((option) => {
                const inputId = `${formId}-priority-${option.value}`;
                return (
                  <span key={option.value}>
                    <input
                      id={inputId}
                      className={styles.choiceInput}
                      type="radio"
                      name={`${formId}-priority`}
                      value={option.value}
                      checked={priority === option.value}
                      onChange={() => setPriority(option.value)}
                    />
                    <label className={styles.priorityChoice} htmlFor={inputId}>
                      {option.label}
                    </label>
                  </span>
                );
              })}
            </div>
          </fieldset>
        </section>

        <section className={styles.section} aria-labelledby={`${formId}-handler-heading`}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>2</span>
            <div>
              <h3 id={`${formId}-handler-heading`}>Who should handle it?</h3>
              <p>Start internally, send it outside, or preserve the issue and decide later.</p>
            </div>
          </div>
          <fieldset className={styles.handlerFieldset}>
            <legend className={styles.srOnly}>Who should handle this work?</legend>

            <div className={styles.handlerGrid}>
              {handlerOptions.map((option) => {
                const inputId = `${formId}-handler-${option.value}`;
                const Icon = option.icon;
                return (
                  <div key={option.value}>
                    <input
                      id={inputId}
                      className={styles.choiceInput}
                      type="radio"
                      name={`${formId}-handler`}
                      value={option.value}
                      checked={fulfillmentMode === option.value}
                      onChange={() => {
                        setFulfillmentMode(option.value);
                        setError(null);
                      }}
                    />
                    <label className={styles.handlerCard} htmlFor={inputId}>
                      <span className={styles.handlerIcon}>
                        <Icon aria-hidden="true" />
                      </span>
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </label>
                  </div>
                );
              })}
            </div>

            {fulfillmentMode === "internal" ? (
              <div className={styles.conditionalPanel}>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-team`}>Internal team or queue</label>
                  <select
                    id={`${formId}-team`}
                    className={styles.select}
                    value={internalTeamId}
                    onChange={(event) => setInternalTeamId(event.target.value)}
                  >
                    <option value="">General internal maintenance queue</option>
                    {internalTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                        {team.coverageLabel ? ` — ${team.coverageLabel}` : ""}
                      </option>
                    ))}
                  </select>
                  <span className={styles.fieldHint}>
                    A specific employee does not need to be assigned at creation.
                  </span>
                </div>
              </div>
            ) : null}

            {fulfillmentMode === "external" ? (
              <div className={styles.conditionalPanel}>
                <VendorPicker
                  vendors={vendors}
                  storeId={storeId || undefined}
                  value={vendorId}
                  onChange={(nextVendorId) => {
                    setVendorId(nextVendorId);
                    setError(null);
                  }}
                />
              </div>
            ) : null}

            {fulfillmentMode === "decide_later" ? (
              <div className={styles.conditionalPanel}>
                <div className={styles.footerNote}>
                  <Info aria-hidden="true" />
                  <span>
                    The work order remains visible and unassigned, with a next action to choose
                    the responsible team or vendor.
                  </span>
                </div>
              </div>
            ) : null}
          </fieldset>

          {error ? (
            <div className={styles.error} role="alert">
              <CircleAlert aria-hidden="true" />
              {error}
            </div>
          ) : null}
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerNote}>
          <Info aria-hidden="true" />
          <span>
            Creating a work order does not automatically send anything. Outside work moves to
            a reviewable vendor service authorization before issuance.
          </span>
        </div>
        <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : submitLabel}
          <ChevronRight aria-hidden="true" />
        </button>
      </footer>
    </form>
  );
}
