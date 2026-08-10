"use client";

import { type FormEvent, useId, useState } from "react";
import { Building2, Check, Clock3, Layers3, MapPin } from "lucide-react";

import type { PostalAddress, Store } from "../../lib/cstore/types";

import styles from "./setup-workflows.module.css";
import type {
  GuidedStoreSetupValue,
  StoreHoursInput,
  StoreSetupCategory,
  StoreSetupRegion,
} from "./setup-workflows";

type GuidedStoreSetupInitialValue = Partial<
  Omit<GuidedStoreSetupValue, "address" | "hours">
> & {
  address?: Partial<PostalAddress>;
  hours?: StoreHoursInput;
};

export interface GuidedStoreSetupProps {
  regions: StoreSetupRegion[];
  categories: StoreSetupCategory[];
  onCreate: (value: GuidedStoreSetupValue) => void | Promise<void>;
  initialValue?: GuidedStoreSetupInitialValue;
  className?: string;
  isSubmitting?: boolean;
}

const formatOptions: Array<{
  value: Store["format"];
  label: string;
  description: string;
}> = [
  {
    value: "fuel_and_market",
    label: "Fuel + market",
    description: "Convenience store with a forecourt.",
  },
  {
    value: "market_only",
    label: "Market only",
    description: "Convenience retail without fuel equipment.",
  },
  {
    value: "travel_center",
    label: "Travel center",
    description: "Larger site with expanded services and equipment.",
  },
];

const defaultStarterKeys = new Set(["refrigeration", "hvac", "fuel_forecourt"]);

export function GuidedStoreSetup({
  regions,
  categories,
  onCreate,
  initialValue,
  className,
  isSubmitting: submittingFromParent = false,
}: GuidedStoreSetupProps) {
  const formId = useId();
  const [storeNumber, setStoreNumber] = useState(initialValue?.storeNumber ?? "");
  const [name, setName] = useState(initialValue?.name ?? "");
  const [line1, setLine1] = useState(initialValue?.address?.line1 ?? "");
  const [line2, setLine2] = useState(initialValue?.address?.line2 ?? "");
  const [city, setCity] = useState(initialValue?.address?.city ?? "");
  const [state, setState] = useState(initialValue?.address?.state ?? "");
  const [postalCode, setPostalCode] = useState(initialValue?.address?.postalCode ?? "");
  const [regionId, setRegionId] = useState(
    initialValue?.regionId ?? (regions.length === 1 ? regions[0]?.id ?? "" : ""),
  );
  const [format, setFormat] = useState<Store["format"]>(
    initialValue?.format ?? "fuel_and_market",
  );
  const [hoursMode, setHoursMode] = useState<StoreHoursInput["mode"]>(
    initialValue?.hours?.mode ?? "open_24_hours",
  );
  const [opensAt, setOpensAt] = useState(
    initialValue?.hours?.mode === "daily_window" ? initialValue.hours.opensAt : "06:00",
  );
  const [closesAt, setClosesAt] = useState(
    initialValue?.hours?.mode === "daily_window" ? initialValue.hours.closesAt : "23:00",
  );
  const [starterCategoryIds, setStarterCategoryIds] = useState<string[]>(() => {
    if (initialValue?.starterCategoryIds) return initialValue.starterCategoryIds;
    const recommended = categories
      .filter((category) => defaultStarterKeys.has(category.key))
      .map((category) => category.id);
    return recommended.length > 0
      ? recommended
      : categories.slice(0, Math.min(3, categories.length)).map((category) => category.id);
  });
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = submittingFromParent || localSubmitting;

  function toggleCategory(categoryId: string) {
    setStarterCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!storeNumber.trim() || !name.trim()) {
      setError("Enter a store number and a store name.");
      return;
    }
    if (!line1.trim() || !city.trim() || state.trim().length !== 2 || !postalCode.trim()) {
      setError("Enter a complete address, including a two-letter state code.");
      return;
    }
    if (!regionId) {
      setError("Choose the region responsible for this store.");
      return;
    }
    if (hoursMode === "daily_window" && (!opensAt || !closesAt)) {
      setError("Enter the store's opening and closing times.");
      return;
    }
    if (starterCategoryIds.length === 0) {
      setError("Select at least one starter service category.");
      return;
    }

    const hours: StoreHoursInput =
      hoursMode === "open_24_hours"
        ? { mode: "open_24_hours" }
        : { mode: "daily_window", opensAt, closesAt };

    try {
      setLocalSubmitting(true);
      await onCreate({
        storeNumber: storeNumber.trim(),
        name: name.trim(),
        address: {
          line1: line1.trim(),
          ...(line2.trim() ? { line2: line2.trim() } : {}),
          city: city.trim(),
          state: state.trim().toUpperCase(),
          postalCode: postalCode.trim(),
          country: "US",
        },
        regionId,
        format,
        hours,
        starterCategoryIds,
      });
    } catch {
      setError("The store could not be created. Nothing was saved; please try again.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form
      className={[styles.root, styles.surface, className].filter(Boolean).join(" ")}
      onSubmit={handleSubmit}
      noValidate
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Store network</span>
          <h2>Add a store</h2>
          <p>
            Set up the location and the services it can request. Equipment and preventive
            maintenance can be added when the store is ready.
          </p>
        </div>
        <span className={styles.headerPill}>
          <Building2 aria-hidden="true" /> Ready in minutes
        </span>
      </header>

      <div className={styles.body}>
        <section className={styles.section} aria-labelledby={`${formId}-location-heading`}>
          <div className={styles.sectionHeading}>
            <span className={styles.step}>1</span>
            <div>
              <h3 id={`${formId}-location-heading`}>Identify the location</h3>
              <p>Store number and address make the location searchable from day one.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor={`${formId}-number`}>Store number</label>
              <input
                id={`${formId}-number`}
                value={storeNumber}
                onChange={(event) => setStoreNumber(event.target.value)}
                placeholder="e.g. 214"
                autoComplete="off"
                required
              />
            </div>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor={`${formId}-name`}>Store name</label>
              <input
                id={`${formId}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Northline — Riverside"
                autoComplete="organization"
                required
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label htmlFor={`${formId}-address-1`}>Street address</label>
              <input
                id={`${formId}-address-1`}
                value={line1}
                onChange={(event) => setLine1(event.target.value)}
                autoComplete="address-line1"
                placeholder="1250 Riverside Drive"
                required
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label htmlFor={`${formId}-address-2`}>
                Suite or unit <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id={`${formId}-address-2`}
                value={line2}
                onChange={(event) => setLine2(event.target.value)}
                autoComplete="address-line2"
              />
            </div>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor={`${formId}-city`}>City</label>
              <input
                id={`${formId}-city`}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                autoComplete="address-level2"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${formId}-state`}>State</label>
              <input
                id={`${formId}-state`}
                value={state}
                onChange={(event) => setState(event.target.value.toUpperCase())}
                autoComplete="address-level1"
                maxLength={2}
                placeholder="OH"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${formId}-postal`}>ZIP code</label>
              <input
                id={`${formId}-postal`}
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                autoComplete="postal-code"
                inputMode="numeric"
                required
              />
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby={`${formId}-operations-heading`}>
          <div className={styles.sectionHeading}>
            <span className={styles.step}>2</span>
            <div>
              <h3 id={`${formId}-operations-heading`}>Set the operating context</h3>
              <p>This controls ownership and gives service partners the right store details.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label htmlFor={`${formId}-region`}>Region</label>
              <select
                id={`${formId}-region`}
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
                required
              >
                <option value="">Choose a region</option>
                {[...regions]
                  .sort((left, right) => left.name.localeCompare(right.name))
                  .map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name} ({region.code})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend>Store format</legend>
            <div className={styles.choiceGrid}>
              {formatOptions.map((option) => (
                <label
                  key={option.value}
                  htmlFor={`${formId}-format-${option.value}`}
                  aria-label={option.label}
                  className={`${styles.choiceCard} ${
                    format === option.value ? styles.choiceCardSelected : ""
                  }`}
                >
                  <input
                    id={`${formId}-format-${option.value}`}
                    type="radio"
                    name={`${formId}-format`}
                    value={option.value}
                    checked={format === option.value}
                    onChange={() => setFormat(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Store hours</legend>
            <div className={styles.hoursRow}>
              <label className={styles.inlineChoice}>
                <input
                  type="radio"
                  name={`${formId}-hours`}
                  checked={hoursMode === "open_24_hours"}
                  onChange={() => setHoursMode("open_24_hours")}
                />
                Open 24 hours
              </label>
              <label className={styles.inlineChoice}>
                <input
                  type="radio"
                  name={`${formId}-hours`}
                  checked={hoursMode === "daily_window"}
                  onChange={() => setHoursMode("daily_window")}
                />
                Daily opening window
              </label>
              {hoursMode === "daily_window" ? (
                <div className={styles.timeFields}>
                  <Clock3 aria-hidden="true" />
                  <label>
                    <span>Opens</span>
                    <input
                      type="time"
                      value={opensAt}
                      onChange={(event) => setOpensAt(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Closes</span>
                    <input
                      type="time"
                      value={closesAt}
                      onChange={(event) => setClosesAt(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </fieldset>
        </section>

        <section className={styles.section} aria-labelledby={`${formId}-services-heading`}>
          <div className={styles.sectionHeading}>
            <span className={styles.step}>3</span>
            <div>
              <h3 id={`${formId}-services-heading`}>Choose starter service categories</h3>
              <p>
                Employees can report work in these areas immediately. Add, rename, or expand
                the equipment hierarchy later.
              </p>
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.srOnly}>Starter service categories</legend>
            <div className={styles.categoryGrid}>
              {[...categories]
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((category) => {
                  const selected = starterCategoryIds.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      htmlFor={`${formId}-category-${category.id}`}
                      aria-label={category.label}
                      className={`${styles.categoryCard} ${
                        selected ? styles.categoryCardSelected : ""
                      }`}
                    >
                      <input
                        id={`${formId}-category-${category.id}`}
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCategory(category.id)}
                      />
                      <span
                        className={styles.categoryMarker}
                        style={{ backgroundColor: category.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.categoryCopy}>
                        <strong>{category.label}</strong>
                        <small>{category.description}</small>
                      </span>
                      <Check className={styles.categoryCheck} aria-hidden="true" />
                    </label>
                  );
                })}
            </div>
          </fieldset>

          <div className={styles.laterNote}>
            <Layers3 aria-hidden="true" />
            <div>
              <strong>Useful now, detailed when you are ready</strong>
              <span>
                The store can create work orders as soon as it is saved. Assets, components,
                warranties, and PM plans remain optional setup steps.
              </span>
            </div>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerSummary}>
          <MapPin aria-hidden="true" />
          <span>
            {starterCategoryIds.length} service {starterCategoryIds.length === 1 ? "category" : "categories"}{" "}
            active at launch
          </span>
        </div>
        <div className={styles.footerActions}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating store…" : "Create store"}
          </button>
        </div>
      </footer>
    </form>
  );
}
