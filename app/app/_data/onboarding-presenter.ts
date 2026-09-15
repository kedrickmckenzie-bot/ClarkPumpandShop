import type { OpsFixture } from "@/lib/ops/types";
import type { OperatorSession, CreateStorePageViewModel, CreateVendorPageViewModel } from "@/components/ops/data-contract";
import { DEFAULT_OPERATIONS_TIME_ZONE } from "@/lib/ops/local-time";
export function buildCreateStoreModel(fixture: Pick<OpsFixture,"organizations"|"regions">, session: OperatorSession): CreateStorePageViewModel {
  const organizationTimeZone = fixture.organizations.find((organization) => organization.id === session.organizationId)?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  return {
    state: { kind: "ready" },
    page: { title: "Add a store", eyebrow: "Network setup", description: "Add the store name, number and address.", scopeLabel: session.scopeLabel },
    submitAction: "/api/ops/stores",
    cancelLink: { label: "Back to stores", href: "/app/stores" },
    regions: fixture.regions.filter((region) => region.organizationId === session.organizationId).map((region) => ({ value: region.id, label: region.name, description: region.code })),
    timeZones: [{ value: "America/New_York", label: "Eastern time" }, { value: "America/Chicago", label: "Central time" }, { value: "America/Denver", label: "Mountain time" }, { value: "America/Los_Angeles", label: "Pacific time" }],
    defaultTimeZone: organizationTimeZone,
  };
}

export function buildCreateVendorModel(fixture: import("@/lib/ops/vendor-onboarding-query").OnboardingConfiguration, session: OperatorSession): CreateVendorPageViewModel {
  const specialtyNames = new Map(fixture.vendorSpecialties.filter((item) => item.organizationId === session.organizationId).map((item) => [item.canonicalKey, item.displayName]));
  return {
    state: { kind: "ready" },
    page: { title: "Add an approved vendor", eyebrow: "Vendor onboarding", description: "Add dispatch details, searchable specialties, and service coverage. A portal account is optional.", scopeLabel: session.scopeLabel },
    submitAction: "/api/ops/vendors",
    cancelLink: { label: "Back to vendors", href: "/app/vendors" },
    specialties: [...specialtyNames.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    coverageScopes: [{ value: session.organizationId, label: "All stores", description: "Companywide coverage" }, ...fixture.regions.filter((region) => region.organizationId === session.organizationId).map((region) => ({ value: region.id, label: region.name, description: "Regional coverage" }))],
  };
}
