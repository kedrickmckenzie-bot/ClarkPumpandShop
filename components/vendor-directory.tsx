"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardList,
  Mail,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Tag,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import Link from "@/components/site-link";
import {
  PlatformBadge,
  PlatformBreadcrumbs,
  PlatformEmpty,
  PlatformPageHeader,
  PlatformSectionHeader,
  PlatformStat,
} from "@/components/platform-ui";
import { isOpenWorkOrder } from "@/lib/domain/analytics";
import { platformData } from "@/lib/platform/data";
import {
  vendorDirectoryProfile,
  vendorSearchText,
  vendorServiceGroups,
} from "@/lib/vendor-directory";

const quickSearches = [
  "Plumber",
  "Refrigeration",
  "Electrician",
  "Snow removal",
  "Fire alarm",
];

export function VendorDirectory() {
  const [query, setQuery] = useState("");
  const [serviceGroup, setServiceGroup] = useState("all");

  const serviceGroups = useMemo(
    () => vendorServiceGroups(platformData.vendors),
    [],
  );
  const vendorRows = useMemo(
    () =>
      platformData.vendors.map((vendor) => {
        const profile = vendorDirectoryProfile(vendor);
        const workOrders = platformData.workOrders.filter(
          (workOrder) => workOrder.vendorId === vendor.id,
        );
        const openWork = workOrders.filter(isOpenWorkOrder);
        const stores = new Set(workOrders.map((workOrder) => workOrder.storeId));
        return {
          vendor,
          profile,
          workOrders,
          openWork,
          stores,
          search: vendorSearchText(vendor),
        };
      }),
    [],
  );
  const visibleVendors = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return vendorRows
      .filter(
        (row) =>
          (serviceGroup === "all" || row.profile.serviceGroup === serviceGroup) &&
          tokens.every((token) => row.search.includes(token)),
      )
      .sort((a, b) => a.vendor.name.localeCompare(b.vendor.name));
  }, [query, serviceGroup, vendorRows]);
  const vendorsWithHistory = vendorRows.filter((row) => row.workOrders.length > 0);
  const openWorkCount = vendorRows.reduce(
    (sum, row) => sum + row.openWork.length,
    0,
  );
  const filtersActive = Boolean(query.trim()) || serviceGroup !== "all";

  function clearFilters() {
    setQuery("");
    setServiceGroup("all");
  }

  return (
    <AppShell>
      <div className="pf-page approved-vendor-page">
        <PlatformBreadcrumbs
          items={[{ label: "Overview", href: "/" }, { label: "Approved vendors" }]}
        />
        <PlatformPageHeader
          eyebrow="Approved vendor network"
          title="Find the right vendor—even when you do not know the company name."
          description="Search the approved list by company, trade, or plain-language work such as plumber, drain, freezer, electrician, or snow removal."
        >
          <Link className="pf-button" href="/accountability">
            <ShieldCheck /> Vendor accountability
          </Link>
          <Link className="pf-button pf-button-primary" href="/work-orders/new">
            <Plus /> Create work order
          </Link>
        </PlatformPageHeader>

        <section className="provider-stat-grid" aria-label="Approved vendor network summary">
          <PlatformStat
            label="Approved vendors"
            value={String(vendorRows.length)}
            note="Available for assignment"
            icon={CheckCircle2}
            href="#approved-vendor-list"
            tone="positive"
          />
          <PlatformStat
            label="Service groups"
            value={String(serviceGroups.length)}
            note="From refrigeration to site services"
            icon={Tag}
            href="#approved-vendor-list"
          />
          <PlatformStat
            label="Vendors with history"
            value={String(vendorsWithHistory.length)}
            note="Open a record to see customer work"
            icon={ClipboardList}
            href="#approved-vendor-list"
            tone="info"
          />
          <PlatformStat
            label="Open vendor work"
            value={String(openWorkCount)}
            note="Across the current demo portfolio"
            icon={BriefcaseBusiness}
            href="/accountability"
          />
        </section>

        <section className="approved-vendor-directory" id="approved-vendor-list">
          <PlatformSectionHeader
            title="Approved vendor list"
            description="Every result below is approved. Search uses names, descriptions, trades, services, and common terms."
          >
            <PlatformBadge tone="good">Approved only</PlatformBadge>
          </PlatformSectionHeader>

          <div className="approved-vendor-search-panel">
            <label className="approved-vendor-search">
              <span>Search approved vendors</span>
              <div>
                <Search aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Try “FlowRite,” “plumber,” “drain,” or “freezer”'
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear vendor search"
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
            </label>
            <label className="approved-vendor-service-filter">
              <span>Service group</span>
              <select
                value={serviceGroup}
                onChange={(event) => setServiceGroup(event.target.value)}
              >
                <option value="all">All service groups</option>
                {serviceGroups.map((group) => (
                  <option value={group} key={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
            <div className="approved-vendor-result-count" aria-live="polite">
              <strong>{visibleVendors.length}</strong>
              <span>approved {visibleVendors.length === 1 ? "vendor" : "vendors"}</span>
            </div>
          </div>

          <div className="approved-vendor-quick-search" aria-label="Common vendor searches">
            <span>Common searches</span>
            {quickSearches.map((term) => (
              <button
                type="button"
                className={query.toLowerCase() === term.toLowerCase() ? "active" : ""}
                onClick={() => {
                  setQuery(term);
                  setServiceGroup("all");
                }}
                key={term}
              >
                {term}
              </button>
            ))}
            {filtersActive && (
              <button type="button" className="approved-vendor-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {visibleVendors.length ? (
            <div className="approved-vendor-grid">
              {visibleVendors.map(({ vendor, profile, openWork, stores }) => (
                <article className="approved-vendor-card" key={vendor.id}>
                  <header>
                    <i style={{ backgroundColor: vendor.accent }} aria-hidden="true">
                      {vendor.shortName.slice(0, 2).toUpperCase()}
                    </i>
                    <div>
                      <PlatformBadge tone="good">Approved</PlatformBadge>
                      <h3>
                        <Link href={`/providers/${vendor.id}`}>{vendor.name}</Link>
                      </h3>
                      <p>{vendor.trade}</p>
                    </div>
                  </header>
                  <p className="approved-vendor-summary">{profile.summary}</p>
                  <div className="approved-vendor-services" aria-label={`${vendor.name} services`}>
                    {profile.services.map((service) => (
                      <span key={service}>{service}</span>
                    ))}
                  </div>
                  <dl className="approved-vendor-facts">
                    <div>
                      <dt><MapPin aria-hidden="true" /> Coverage</dt>
                      <dd>{profile.coverage}</dd>
                    </div>
                    <div>
                      <dt><Store aria-hidden="true" /> Customer history</dt>
                      <dd>{stores.size ? `${stores.size} stores with recorded work` : "No work recorded yet"}</dd>
                    </div>
                    <div>
                      <dt><BriefcaseBusiness aria-hidden="true" /> Current work</dt>
                      <dd>{openWork.length} open work {openWork.length === 1 ? "order" : "orders"}</dd>
                    </div>
                  </dl>
                  <footer>
                    <a href={`mailto:${vendor.dispatchEmail}`}>
                      <Mail aria-hidden="true" /> Email dispatch
                    </a>
                    <Link href={`/providers/${vendor.id}`}>
                      Open vendor record <ArrowRight aria-hidden="true" />
                    </Link>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <PlatformEmpty
              icon={Search}
              title="No approved vendors match"
              description="Try a company name, trade, service description, or a broader term such as plumber, refrigeration, electrical, or grounds."
              action={
                <button type="button" className="pf-button" onClick={clearFilters}>
                  Clear search and filters
                </button>
              }
            />
          )}
        </section>

        <section className="approved-vendor-help">
          <Building2 aria-hidden="true" />
          <div>
            <strong>Need a vendor that is not listed?</strong>
            <p>Vendor onboarding, approval, service coverage, and contacts belong in setup. The directory shows only approved records available for assignment.</p>
          </div>
          <Link href="/setup?section=routing">Manage coverage <ArrowRight aria-hidden="true" /></Link>
        </section>
      </div>
    </AppShell>
  );
}
