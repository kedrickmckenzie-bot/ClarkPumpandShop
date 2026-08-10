"use client";

import { useId, useMemo, useState } from "react";
import {
  BadgeCheck,
  Mail,
  MapPin,
  Search,
  SearchX,
  X,
} from "lucide-react";

import styles from "./cstore-workflows.module.css";
import type { VendorOption } from "./types";

export interface VendorPickerProps {
  vendors: VendorOption[];
  value?: string;
  onChange: (vendorId: string) => void;
  storeId?: string;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

function searchableText(vendor: VendorOption) {
  return [
    vendor.name,
    vendor.description,
    ...(vendor.specialties ?? []),
    ...(vendor.aliases ?? []),
    ...(vendor.coverage ?? []),
    vendor.dispatchEmail,
    vendor.dispatchPhone,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function matchesSearch(vendor: VendorOption, query: string) {
  const terms = query
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return true;
  const haystack = searchableText(vendor);
  return terms.every((term) => haystack.includes(term));
}

export function VendorPicker({
  vendors,
  value,
  onChange,
  storeId,
  label = "Choose an outside vendor",
  description = "Search by company name, specialty, common name, or service area.",
  className,
  disabled = false,
}: VendorPickerProps) {
  const groupId = useId();
  const searchId = `${groupId}-search`;
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    return vendors
      .filter((vendor) => matchesSearch(vendor, query))
      .sort((left, right) => {
        const leftPreferred = storeId
          ? Number(left.preferredStoreIds?.includes(storeId) ?? false)
          : 0;
        const rightPreferred = storeId
          ? Number(right.preferredStoreIds?.includes(storeId) ?? false)
          : 0;

        if (leftPreferred !== rightPreferred) return rightPreferred - leftPreferred;
        return left.name.localeCompare(right.name);
      });
  }, [query, storeId, vendors]);

  return (
    <fieldset
      className={[styles.root, styles.pickerFieldset, className].filter(Boolean).join(" ")}
      disabled={disabled}
    >
      <legend className={styles.fieldLabel}>{label}</legend>
      <div className={styles.pickerHeader}>
        <p>{description}</p>
        <span className={styles.resultCount} aria-live="polite">
          {results.length} {results.length === 1 ? "vendor" : "vendors"}
        </span>
      </div>

      <div className={styles.searchWrap}>
        <Search aria-hidden="true" />
        <input
          id={searchId}
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “refrigeration,” “beer cave,” or a vendor name"
          aria-label="Search outside vendors"
          autoComplete="off"
        />
        {query ? (
          <button
            className={styles.clearSearch}
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear vendor search"
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {results.length > 0 ? (
        <div className={styles.vendorList} aria-label="Approved vendor search results">
          {results.map((vendor) => {
            const preferred = Boolean(
              storeId && vendor.preferredStoreIds?.includes(storeId),
            );
            const coversStore = Boolean(
              !storeId ||
                !vendor.coveredStoreIds ||
                vendor.coveredStoreIds.length === 0 ||
                vendor.coveredStoreIds.includes(storeId),
            );
            const inputId = `${groupId}-${vendor.id}`;

            return (
              <div key={vendor.id}>
                <input
                  id={inputId}
                  className={styles.choiceInput}
                  type="radio"
                  name={`${groupId}-vendor`}
                  value={vendor.id}
                  checked={value === vendor.id}
                  onChange={() => onChange(vendor.id)}
                />
                <label className={styles.vendorCard} htmlFor={inputId}>
                  <span className={styles.vendorIdentity}>
                    <span className={styles.vendorTitleRow}>
                      <strong>{vendor.name}</strong>
                      {preferred ? (
                        <span className={styles.preferredBadge}>
                          <BadgeCheck aria-hidden="true" />
                          Preferred here
                        </span>
                      ) : null}
                      {coversStore ? (
                        <span className={styles.coverageBadge}>
                          <MapPin aria-hidden="true" />
                          Covers this store
                        </span>
                      ) : null}
                    </span>
                    {vendor.description ? (
                      <span className={styles.vendorDescription}>{vendor.description}</span>
                    ) : null}
                    <span className={styles.tagRow} aria-label="Vendor specialties">
                      {vendor.specialties.slice(0, 5).map((specialty) => (
                        <span className={styles.tag} key={specialty}>
                          {specialty}
                        </span>
                      ))}
                    </span>
                  </span>

                  <span className={styles.vendorMeta}>
                    <span>
                      <MapPin aria-hidden="true" />
                      {vendor.coverage.length > 0
                        ? vendor.coverage.slice(0, 2).join(" · ")
                        : "Coverage not listed"}
                    </span>
                    {vendor.dispatchEmail ? (
                      <span>
                        <Mail aria-hidden="true" />
                        {vendor.dispatchEmail}
                      </span>
                    ) : null}
                    {vendor.afterHoursLabel ? <span>{vendor.afterHoursLabel}</span> : null}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState} role="status">
          <SearchX aria-hidden="true" />
          <strong>No approved vendors match that search</strong>
          <p>
            Try a broader trade, equipment type, service area, or vendor alias. The work
            order can also be saved with “Decide later.”
          </p>
        </div>
      )}
    </fieldset>
  );
}
